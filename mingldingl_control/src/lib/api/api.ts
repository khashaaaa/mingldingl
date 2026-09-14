import axios from 'axios';
import { clearToken, getToken } from '../auth';
import { markSessionExpired } from '../session';

export const LONG_REQUEST_TIMEOUT_MS = 120_000;

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5150',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 used to hard-reload to /login, which threw away whatever the admin was typing. Now the
// session is marked expired and SessionGuard asks them to sign in again over the current page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url === '/admin/auth/login';
    if (error.response?.status === 401 && !isLoginRequest) {
      clearToken();
      markSessionExpired();
    }
    return Promise.reject(error);
  },
);
