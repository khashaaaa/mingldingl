import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/api/apiClient';
import { queryClient } from '../lib/api/queryClient';
import { useAuthStore } from '../store/authStore';
import { i18n } from '../lib/i18n';
import { getApiErrorMessage } from '../lib/api/errors';

export function isPhoneValid(phone: string): boolean {
  return /^\d{8}$/.test(phone);
}

const AUTH_CALL_TIMEOUT_MS = 10000;

/**
 * The verification id each number was last given, so re-entering the same number (back from the
 * OTP screen, a backgrounded app) resumes that session rather than opening a second one — the
 * engine only hands a pending session back to the caller who can name it.
 */
const lastVerificationIdByPhone = new Map<string, string>();

/** verify.mn's own guidance: never poll faster than 3s — SMS delivery is not sub-second. */
export const VERIFICATION_POLL_MS = 3000;

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${AUTH_CALL_TIMEOUT_MS}ms`)), AUTH_CALL_TIMEOUT_MS);
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

async function supabaseAuthFetch(path: string, method: 'POST' | 'PUT', body: unknown, accessToken?: string) {
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json?.msg ?? json?.message ?? json?.error_description ?? `${path} failed (${res.status})`);
  }
  return json;
}

export interface PhoneVerification {
  verificationId: string;
  /** verify.mn's Mongolian instruction copy. Shown verbatim — it names the SIM to send from. */
  displayInstruction: string;
  /** Opens the SMS app pre-filled, so the code is never typed by hand. */
  smsUri: string;
  /**
   * The same code the sms: URI carries, so the "text CODE to 144773 yourself" fallback does not
   * depend on parsing the provider's URI — that fallback is exactly what the user needs when
   * opening their SMS app failed.
   */
  code: string;
  shortcode: string;
  expiresAt: string;
}

export type VerificationOutcome = 'verified' | 'pending' | 'expired' | 'error';

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);
  const inFlight = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Asks the engine to open a verify.mn session. The engine holds the API key and generates the
   * code; the app only ever sees the instruction and the sms: URI.
   */
  async function startPhoneVerification(phone: string): Promise<PhoneVerification | null> {
    if (!isPhoneValid(phone)) {
      setError(i18n.t('phone_invalid'));
      return null;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.auth.startPhoneVerification(phone, lastVerificationIdByPhone.get(phone));
      if (res.verificationId) lastVerificationIdByPhone.set(phone, res.verificationId);
      return {
        verificationId: res.verificationId ?? '',
        displayInstruction: res.displayInstruction ?? '',
        smsUri: res.smsUri ?? '',
        code: res.code ?? '',
        shortcode: res.shortcode ?? '144773',
        expiresAt: res.expiresAt ?? new Date().toISOString(),
      };
    } catch (err) {
      setError(getApiErrorMessage(err, i18n.t('verification_start_failed')));
      return null;
    } finally {
      setLoading(false);
    }
  }

  /** One poll tick. The engine re-reads authoritative status from verify.mn. */
  async function checkVerification(verificationId: string): Promise<VerificationOutcome> {
    try {
      const res = await apiClient.auth.phoneVerificationStatus(verificationId);
      if (res.status === 'Verified') return 'verified';
      if (res.status === 'Expired') return 'expired';
      return 'pending';
    } catch {
      return 'error';
    }
  }

  /**
   * Completes sign-in for an already-verified number: creates the Supabase session, then binds the
   * verification to it. The binding is what the engine trusts — the JWT's phone claim is not proof.
   */
  async function completeSignIn(verificationId: string, phone: string): Promise<boolean> {
    if (inFlight.current) return false;
    inFlight.current = true;
    setLoading(true);
    setError(null);

    let session: Session;
    try {
      session = await withTimeout(supabaseAuthFetch('/auth/v1/signup', 'POST', {}), 'signUp (REST)') as Session;
    } catch {
      setLoading(false);
      inFlight.current = false;
      setError(i18n.t('otp_timed_out'));
      return false;
    }

    try {
      await withTimeout(supabaseAuthFetch('/auth/v1/user', 'PUT', { data: { phone } }, session.access_token), 'updateUser (REST)');
      const refreshed = await withTimeout(
        supabaseAuthFetch('/auth/v1/token?grant_type=refresh_token', 'POST', { refresh_token: session.refresh_token }),
        'refreshSession (REST)',
      );
      session = refreshed as Session;
    } catch {
      // Non-fatal: the phone the engine trusts comes from the claim below, not this metadata.
    }

    // Must succeed before ANY session is published — the engine refuses to create the account
    // without it, and for a returning user the claim is also what lets the engine resolve this
    // fresh anonymous identity onto their existing account. Publishing the session first let
    // every session-gated query fire against an identity the engine could not see yet: /users/me
    // 404'd, the profile cached as null, and the returning user landed in onboarding behind a
    // "No such traveler" alert.
    try {
      await apiClient.auth.claimPhoneVerification(verificationId, session.access_token);
    } catch {
      setLoading(false);
      inFlight.current = false;
      setError(i18n.t('verification_claim_failed'));
      return false;
    }

    try {
      await withTimeout(
        supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }),
        'setSession',
      );
    } catch {
      // The claim is single use and already bound to this identity, so signing out here would
      // strand it. The store session below is what the API client actually reads; Supabase's own
      // client only loses realtime and background refresh, which recover on the next launch.
    }

    setLoading(false);
    inFlight.current = false;
    setSession(session);
    return true;
  }

  async function signOut() {
    if (Platform.OS !== 'web') {
      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        await apiClient.push.unregister(token).catch(() => {});
      } catch {
        // Push de-registration is best-effort; never block sign-out on it.
      }
    }

    await withTimeout(supabase.auth.signOut(), 'signOut').catch(() => {});
    clearSession();

    queryClient.clear();
  }

  return {
    startPhoneVerification,
    checkVerification,
    completeSignIn,
    signOut,
    loading,
    error,
    clearError,
  };
}
