import axios, { type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../../store/authStore';
import { queryClient } from './queryClient';

/**
 * The Supabase client, loaded on first use rather than at import. This module is imported all over
 * the app — including by code whose tests never mock Supabase — and creating the client needs env
 * config, while only the 401 recovery path below actually talks to it.
 */
function supabaseClient(): typeof import('../supabase').supabase {
  return (require('../supabase') as typeof import('../supabase')).supabase;
}

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5150';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

export const UPLOAD_TIMEOUT_MS = 60000;

api.interceptors.request.use((config) => {
  const session = useAuthStore.getState().session;
  if (session) config.headers.Authorization = `Bearer ${session.access_token}`;
  return config;
});

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Trades the stored refresh token for a new access token, once, however many requests 401 at the
 * same moment. Resolves null when the session cannot be renewed.
 *
 * Uses the store's refresh token rather than Supabase's own current session: sign-in publishes the
 * store session even when `supabase.auth.setSession` failed, and the store is what requests carry.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const before = useAuthStore.getState().session;
    try {
      const { data, error } = await supabaseClient().auth.refreshSession(
        before?.refresh_token ? { refresh_token: before.refresh_token } : undefined,
      );
      if (error || !data.session) return null;
      // Signed out (or switched account) while the refresh was out: do not resurrect it.
      if (useAuthStore.getState().session?.refresh_token !== before?.refresh_token) return null;
      useAuthStore.getState().setSession(data.session);
      return data.session.access_token;
    } catch {
      return null;
    }
  })().finally(() => { refreshInFlight = null; });
  return refreshInFlight;
}

type RetriableConfig = InternalAxiosRequestConfig & { _authRetried?: boolean };

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Only a request that actually carried a token can tell us the session is dead. A query
    // firing in the gap between mount and sign-in goes out with no Authorization header, and
    // treating that 401 as an expiry signed the user straight back out.
    const config = error?.config as RetriableConfig | undefined;
    const sentToken = Boolean(config?.headers?.Authorization);
    if (error?.response?.status === 401 && sentToken) {
      // An access token that lapsed while the app was backgrounded (auto-refresh does not run
      // then) is not a dead session. Renew once and replay the request before giving up on it.
      if (config && !config._authRetried) {
        config._authRetried = true;
        const token = await refreshAccessToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
          return api.request(config);
        }
      }

      useAuthStore.getState().clearSession();
      queryClient.clear();
      // Drop Supabase's own copy too, or its auto-refresh keeps a session the app has abandoned.
      // Local scope: the token is already refused, so there is nothing to revoke server-side. The
      // push token cannot be unregistered here — that call needs the very session that just died.
      void Promise.resolve()
        .then(() => supabaseClient().auth.signOut({ scope: 'local' }))
        .catch(() => {});
    }
    // A ban answers *every* request this way. Signing them out here would drop them at the phone
    // screen with no explanation and let them straight back in, so the session is kept and the
    // root layout says what happened instead.
    if (error?.response?.status === 403 && error?.response?.data?.code === 'account.suspended') {
      useAuthStore.getState().setSuspended(true);
    }
    return Promise.reject(error);
  },
);

export { getApiErrorMessage } from './errors';
