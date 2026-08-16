import axios from 'axios';
import { clearToken, getToken } from '../auth';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5150',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 on a protected endpoint means the admin token is missing/expired —
// clear it and send the admin back to the login screen. A full reload (not
// client-side nav) is deliberate: simplest way to reset all in-flight query
// state for a single-admin internal tool with no other auth-state management.
//
// The login endpoint itself is excluded: a wrong-password attempt also 401s,
// but that's an expected, already-handled response (Login.tsx shows "Invalid
// username or password" inline) — without this exclusion, this interceptor
// fired on that response too and force-reloaded the login page before the
// error could ever render, silently clearing the form with no feedback.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url === '/admin/auth/login';
    if (error.response?.status === 401 && !isLoginRequest) {
      clearToken();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);
