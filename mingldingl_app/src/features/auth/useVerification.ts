import Constants from 'expo-constants';
import { useIsFocused } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { duration } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import { checkPhone, completePhone, completeSigil, startPhone, startSigil } from '@/lib/api/generated/engine';
import type { StartResponse } from '@/lib/api/generated/model';
import { getLocale } from '@/lib/i18n';
import { allyCall, forgetAllyCall } from '@/lib/links';
import { signIn } from '@/lib/session';

/** WeSend's codes are six digits. */
export const CODE_LENGTH = 6;

/**
 * How long "The gate opens" stays before the session is stored. Storing it moves the gate at once,
 * so without the hold the seal breaks off-screen.
 */
export const OPENING_HOLD_MS = duration.ceremonyMin;

/** While the road is broken, how often to try it again — the screen promises to carry on by itself. */
export const OFFLINE_RETRY_MS = 5000;

/** The id a number was last given, so a reopened app resumes it instead of sending another text. */
export const verifyKey = (phone: string) => `mingl.verify.${phone}`;

/** waiting: the code is texted; `error` once a typed code (or a second one asked too soon) was refused. */
export type Verification =
  | { kind: 'starting' }
  | { kind: 'waiting'; v: StartResponse; checking?: boolean; error?: ApiError }
  | { kind: 'opening' }
  | { kind: 'expired' }
  | { kind: 'failed'; error: ApiError };

/** A code that is too old, spent, or tried too often needs a fresh one, same as an expiry. */
const NEEDS_NEW_CODE = new Set([
  'auth.verification_expired',
  'auth.already_claimed',
  'auth.too_many_attempts',
]);

const asApiError = (e: unknown) =>
  e instanceof ApiError ? e : new ApiError('network', 0, 'network', String(e));

/**
 * What a proven number is for: signing in (a session; the gate moves the person on) or moving a
 * signed-in character to a new sigil (`onMoved` runs once the engine has moved it).
 */
export type VerificationPurpose = { kind: 'signIn' } | { kind: 'sigil'; onMoved: () => void };

const SIGN_IN: VerificationPurpose = { kind: 'signIn' };

/**
 * Start (or resume) a verification for `phone` — WeSend texts the code — then check the code the
 * person types and complete it into a session (or a sigil move). It never navigates on its own.
 */
export function useVerification(phone: string, purpose: VerificationPurpose = SIGN_IN) {
  const [state, setState] = useState<Verification>({ kind: 'starting' });
  const focused = useIsFocused();
  const alive = useRef(true);
  const busy = useRef(false);
  const last = useRef<StartResponse | null>(null);

  const set = useCallback((s: Verification) => {
    if (alive.current) setState(s);
  }, []);

  const start = useCallback(
    async (resume: boolean, quiet = false) => {
      // A background retry keeps "The road is broken" on screen until it succeeds.
      if (!quiet) set({ kind: 'starting' });
      const key = verifyKey(phone);
      try {
        const resumeVerificationId = resume ? await SecureStore.getItemAsync(key) : null;
        const locale = getLocale() === 'en' ? 'en' : 'mn';
        const v =
          purpose.kind === 'sigil'
            ? await startSigil({ phone, resumeVerificationId, locale })
            : await startPhone({ phone, resumeVerificationId, locale });
        await SecureStore.setItemAsync(key, v.verificationId);
        last.current = v;
        set({ kind: 'waiting', v });
      } catch (e) {
        const error = asApiError(e);
        // Asked again too soon: the code already sent still stands.
        if (error.code === 'auth.code_cooldown' && last.current)
          set({ kind: 'waiting', v: last.current, error });
        else set({ kind: 'failed', error });
      }
    },
    [phone, purpose.kind, set],
  );

  const complete = useCallback(
    async (verificationId: string) => {
      set({ kind: 'opening' });
      try {
        if (purpose.kind === 'sigil') {
          await completeSigil({ verificationId });
          await SecureStore.deleteItemAsync(verifyKey(phone));
          await new Promise((r) => setTimeout(r, OPENING_HOLD_MS));
          purpose.onMoved();
          return;
        }
        const pair = await completePhone({
          verificationId,
          deviceName: deviceName(),
          allyCode: await allyCall(),
        });
        await SecureStore.deleteItemAsync(verifyKey(phone));
        await forgetAllyCall();
        await new Promise((r) => setTimeout(r, OPENING_HOLD_MS));
        await signIn(pair);
      } catch (e) {
        const err = asApiError(e);
        set(NEEDS_NEW_CODE.has(err.code) ? { kind: 'expired' } : { kind: 'failed', error: err });
      }
    },
    [phone, purpose, set],
  );

  const v = state.kind === 'waiting' ? state.v : null;

  /** The person typed the code. A wrong one stays on screen to be typed again. */
  const submit = useCallback(
    async (code: string) => {
      if (!v || busy.current) return;
      busy.current = true;
      set({ kind: 'waiting', v, checking: true });
      try {
        await checkPhone({ verificationId: v.verificationId, code });
        await complete(v.verificationId);
      } catch (e) {
        const error = asApiError(e);
        set(NEEDS_NEW_CODE.has(error.code) ? { kind: 'expired' } : { kind: 'waiting', v, error });
      } finally {
        busy.current = false;
      }
    },
    [v, complete, set],
  );

  useEffect(() => {
    alive.current = true;
    start(true);
    return () => {
      alive.current = false;
    };
  }, [start]);

  const offline = state.kind === 'failed' && state.error.kind === 'network';
  useEffect(() => {
    if (!focused || !offline) return;
    let trying = false;
    const again = async () => {
      if (trying) return; // an offline request can hang longer than the interval
      trying = true;
      await start(true, true);
      trying = false;
    };
    const timer = setInterval(again, OFFLINE_RETRY_MS);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') again();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [focused, offline, start]);

  return { state, submit, newCode: () => start(false), retry: () => start(true) };
}

function deviceName(): string {
  return Constants.deviceName ?? Platform.OS;
}
