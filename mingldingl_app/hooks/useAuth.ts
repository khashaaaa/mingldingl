import { useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/api/apiClient';
import { useAuthStore } from '../store/authStore';
import { i18n } from '../lib/i18n';

export function isPhoneValid(phone: string): boolean {
  return /^\d{8}$/.test(phone);
}

const AUTH_CALL_TIMEOUT_MS = 10000;

// supabase-js's internal call coordination (its own comment for it: "lockless
// coordination: refresh single-flight + commit guard") has been observed to
// silently hang — never resolving *or* rejecting — on React Native/Expo Go,
// and not always on the same call: signInAnonymously, updateUser, and
// refreshSession have each hung on different runs with identical app code.
// Since it's a library-internal coordination bug rather than anything
// traceable to one call site, every auth call here race a timeout instead of
// trusting each one to eventually settle on its own.
function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${AUTH_CALL_TIMEOUT_MS}ms`)), AUTH_CALL_TIMEOUT_MS);
  });
  // Clear the timer once either side settles — otherwise a promise call that
  // *does* resolve normally still leaves its losing timer alive to fire
  // later, rejecting with nothing to catch it (an unhandled rejection) and
  // keeping the timer itself alive in the meantime.
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Goes straight to Supabase's REST auth API instead of the supabase-js
// client — every one of these direct calls has resolved reliably in
// testing (proven with a side-by-side raw fetch() race against the SDK
// call, which hung), unlike signInAnonymously/updateUser/refreshSession
// through the SDK. Used only for the sign-in path itself; everything after
// that still goes through the normal apiClient/supabase client as usual.
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

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  async function sendOtp(_phone: string): Promise<boolean> {
    return true; // SMS not configured — any 6-digit code accepted
  }

  async function verifyOtp(phone: string, token: string): Promise<boolean> {
    if (!/^\d{6}$/.test(token)) { setError(i18n.t('otp_invalid_code')); return false; }
    setLoading(true);
    setError(null);

    let session: Session;
    try {
      session = await withTimeout(supabaseAuthFetch('/auth/v1/signup', 'POST', {}), 'signInAnonymously (REST)') as Session;
    } catch {
      setLoading(false);
      setError(i18n.t('otp_timed_out'));
      return false;
    }

    // SMS isn't configured, so each login is a fresh anonymous Supabase
    // identity with no memory of the phone number. Stamp the phone onto
    // user_metadata (unconfirmed — no OTP round trip needed) and refresh so
    // the JWT carries it; the engine then aliases this new identity back to
    // whichever account first claimed that phone number, instead of
    // treating every returning user as brand new.
    try {
      await withTimeout(supabaseAuthFetch('/auth/v1/user', 'PUT', { data: { phone } }, session.access_token), 'updateUser (REST)');
      const refreshed = await withTimeout(
        supabaseAuthFetch('/auth/v1/token?grant_type=refresh_token', 'POST', { refresh_token: session.refresh_token }),
        'refreshSession (REST)',
      );
      session = refreshed as Session;
    } catch {
      // Best-effort: stay signed in anonymously even if linking the phone
      // fails or times out — the initial sign-in above already succeeded.
    }

    // Best-effort, fire-and-forget: also hydrate supabase-js's own client
    // state, since a few features (chat/realtime) go through the SDK
    // directly rather than useAuthStore. Not awaited — this can be as slow
    // or as stuck as it wants without adding to the user's wait, since
    // useAuthStore below (the app's actual source of truth for routing and
    // every apiClient call) is set unconditionally regardless of this.
    withTimeout(supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }), 'setSession')
      .catch(() => {});

    setLoading(false);
    setSession(session);
    return true;
  }

  async function signOut() {
    // Best-effort: without this, a signed-out device keeps receiving the
    // outgoing account's match/message pushes until a different account
    // registers the same token and overwrites it server-side. Same
    // getExpoPushTokenAsync() call usePushNotifications.ts uses to
    // register — it returns the same stable per-device token, so no
    // separate storage of the token is needed just to unregister it.
    if (Platform.OS !== 'web') {
      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        await apiClient.push.unregister(token).catch(() => {});
      } catch {
        // push unavailable in this environment (Expo Go, no EAS projectId) — nothing to unregister
      }
    }
    // Best-effort and timeout-guarded, same reasoning as verifyOtp above —
    // clearSession() (the local store, which everything else in the app
    // actually reads) runs unconditionally either way, so a hang here can't
    // leave the user stuck mid-sign-out.
    await withTimeout(supabase.auth.signOut(), 'signOut').catch(() => {});
    clearSession();
  }

  return { sendOtp, verifyOtp, signOut, loading, error };
}
