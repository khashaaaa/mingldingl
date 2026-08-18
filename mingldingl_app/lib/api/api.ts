import axios from 'axios';
import { useAuthStore } from '../../store/authStore';

export const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5150',
  timeout: 10000,
});

// A plain JSON request that takes 10s is almost certainly stuck — but a
// multi-photo upload over a slow connection can legitimately take longer
// than that. Per-request override (see apiClient.photos.upload) instead of
// raising the global default, so a truly-stuck JSON request still fails fast.
export const UPLOAD_TIMEOUT_MS = 60000;

// Reads the token straight from the app's own auth store instead of calling
// supabase.auth.getSession() — that call goes through supabase-js's internal
// call coordination, which has been observed to hang indefinitely and
// unpredictably on React Native (see AUTH_CALL_TIMEOUT_MS in hooks/useAuth.ts
// for the fuller writeup). This interceptor runs before every single
// authenticated request in the app, so a hang here would silently freeze
// every screen rather than just sign-in — axios's own `timeout` above never
// even starts counting until the request is actually dispatched, so it can't
// catch a stall that happens before that. useAuthStore's session is already
// the app's single source of truth (kept current by _layout.tsx's
// onAuthStateChange listener and by useAuth's sign-in flow), so reading it
// synchronously here is both safer and cheaper than asking the SDK again.
api.interceptors.request.use((config) => {
  const session = useAuthStore.getState().session;
  if (session) config.headers.Authorization = `Bearer ${session.access_token}`;
  return config;
});

// Previously there was no response interceptor at all — a 401 (expired/
// invalid Supabase JWT) just made whichever request happened to fire it fail
// generically, with no recovery path. Clearing the session here is enough to
// recover: _layout.tsx's routing effect already redirects to (auth)/phone
// the instant `session` becomes null, the same way a real sign-out does — no
// separate navigation call needed. verifyOtp's own sign-in requests can't
// 401 (there's no session yet to be invalid), so this can't fight the login
// flow the way mingldingl_control's equivalent interceptor has to guard
// against for its login endpoint.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().clearSession();
    }
    return Promise.reject(error);
  },
);

// Every non-2xx response from the engine is { error: "message" } (see
// ApiErrorExtensions.cs) — this is the one place that knows that shape, so
// callers get a real server-reported message instead of each hand-rolling
// the same `err.response?.data?.error` reach-in (or missing it and falling
// back to a generic "something went wrong" that hides what the server
// actually said).
export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: unknown } }).response?.data;
    if (data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string') {
      return (data as { error: string }).error;
    }
  }
  return fallback;
}
