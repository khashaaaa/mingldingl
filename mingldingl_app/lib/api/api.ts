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
    // Only a request that actually carried a token can tell us the session is dead. A query
    // firing in the gap between mount and sign-in goes out with no Authorization header, and
    // treating that 401 as an expiry signed the user straight back out.
    const sentToken = Boolean(error?.config?.headers?.Authorization);
    if (error?.response?.status === 401 && sentToken) {
      useAuthStore.getState().clearSession();

      queryClient.clear();
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
