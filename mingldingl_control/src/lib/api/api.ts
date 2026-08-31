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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url === '/admin/auth/login';
    if (error.response?.status === 401 && !isLoginRequest) {
      clearToken();
      const current = window.location.pathname + window.location.search;
      const next = current.startsWith('/login') || current === '/' ? '' : `?next=${encodeURIComponent(current)}`;
      window.location.href = `/login${next}`;
    }
    return Promise.reject(error);
  },
);
