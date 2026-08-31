import axios from 'axios';
import { useAuthStore } from '../../store/authStore';
import { queryClient } from './queryClient';

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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().clearSession();

      queryClient.clear();
    }
    return Promise.reject(error);
  },
);

export { getApiErrorMessage } from './errors';
