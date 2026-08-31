import { useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { apiClient } from '../lib/api/apiClient';
import { queryClient } from '../lib/api/queryClient';
import { useAuthStore } from '../store/authStore';
import { i18n } from '../lib/i18n';

export function isPhoneValid(phone: string): boolean {
  return /^\d{8}$/.test(phone);
}

const AUTH_CALL_TIMEOUT_MS = 10000;

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

export function useAuth() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setSession = useAuthStore((s) => s.setSession);
  const clearSession = useAuthStore((s) => s.clearSession);

  async function sendOtp(_phone: string): Promise<boolean> {
    return true;
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

    try {
      await withTimeout(supabaseAuthFetch('/auth/v1/user', 'PUT', { data: { phone } }, session.access_token), 'updateUser (REST)');
      const refreshed = await withTimeout(
        supabaseAuthFetch('/auth/v1/token?grant_type=refresh_token', 'POST', { refresh_token: session.refresh_token }),
        'refreshSession (REST)',
      );
      session = refreshed as Session;
    } catch {
    }

    withTimeout(supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token }), 'setSession')
      .catch(() => {});

    setLoading(false);
    setSession(session);
    return true;
  }

  async function signOut() {
    if (Platform.OS !== 'web') {
      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync();
        await apiClient.push.unregister(token).catch(() => {});
      } catch {
      }
    }

    await withTimeout(supabase.auth.signOut(), 'signOut').catch(() => {});
    clearSession();

    queryClient.clear();
  }

  return { sendOtp, verifyOtp, signOut, loading, error };
}
