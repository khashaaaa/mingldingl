import { api } from '../api';
import { queryClient } from '../queryClient';
import { useAuthStore } from '../../../store/authStore';

describe('api 401 response interceptor', () => {
  const rejected = (api.interceptors.response as any).handlers
    .map((h: any) => h?.rejected)
    .find(Boolean);

  const fakeSession = { access_token: 'tok', user: { id: 'u1' } } as any;

  beforeEach(() => {
    useAuthStore.setState({ session: fakeSession });
    queryClient.setQueryData(['userProfile'], { displayName: 'Old Account' });
  });

  afterEach(() => {
    useAuthStore.setState({ session: null });
    queryClient.clear();
  });

  const authed = { headers: { Authorization: 'Bearer tok' } };

  it('clears the session AND the query cache on 401', async () => {
    const err = { response: { status: 401 }, config: authed };

    await expect(rejected(err)).rejects.toBe(err);

    expect(useAuthStore.getState().session).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('leaves session and cache alone on non-401 errors', async () => {
    const err = { response: { status: 500 }, config: authed };

    await expect(rejected(err)).rejects.toBe(err);

    expect(useAuthStore.getState().session).toBe(fakeSession);
    expect(queryClient.getQueryData(['userProfile'])).toEqual({ displayName: 'Old Account' });
  });

  // Queries mounted before sign-in completes go out with no Authorization header. That 401 says
  // "you never sent a token", not "your token expired" — signing the user out on it is a
  // self-inflicted logout during the login transition.
  it('leaves session and cache alone on a 401 for a request that carried no token', async () => {
    const err = { response: { status: 401 }, config: { headers: {} } };

    await expect(rejected(err)).rejects.toBe(err);

    expect(useAuthStore.getState().session).toBe(fakeSession);
    expect(queryClient.getQueryData(['userProfile'])).toEqual({ displayName: 'Old Account' });
  });
});
