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
