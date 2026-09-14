import { api } from '../api';
import { queryClient } from '../queryClient';
import { useAuthStore } from '../../../store/authStore';
import { supabase } from '../../supabase';

jest.mock('../../supabase', () => ({
  supabase: {
    auth: {
      refreshSession: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

const mockRefresh = supabase.auth.refreshSession as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('api 401 response interceptor', () => {
  const rejected = (api.interceptors.response as any).handlers
    .map((h: any) => h?.rejected)
    .find(Boolean);

  const fakeSession = { access_token: 'tok', refresh_token: 'rt', user: { id: 'u1' } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ session: fakeSession });
    queryClient.setQueryData(['userProfile'], { displayName: 'Old Account' });
    mockRefresh.mockResolvedValue({ data: { session: null }, error: new Error('refresh token revoked') });
    mockSignOut.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    useAuthStore.setState({ session: null, suspended: false });
    queryClient.clear();
  });

  const authed = () => ({ headers: { Authorization: 'Bearer tok' } });

  it('clears the session AND the query cache on a 401 the session cannot be refreshed past', async () => {
    const err = { response: { status: 401 }, config: authed() };

    await expect(rejected(err)).rejects.toBe(err);

    expect(mockRefresh).toHaveBeenCalledWith({ refresh_token: 'rt' });
    expect(useAuthStore.getState().session).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('signs Supabase out locally when it gives up on the session', async () => {
    const err = { response: { status: 401 }, config: authed() };

    await expect(rejected(err)).rejects.toBe(err);
    await flush();

    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  // An access token that lapsed while the app was backgrounded is not a dead session. Clearing it
  // bounced the person to the phone screen every time they came back to the app.
  it('refreshes once and replays the request instead of signing out', async () => {
    const renewed = { access_token: 'new-tok', refresh_token: 'rt2', user: { id: 'u1' } };
    mockRefresh.mockResolvedValue({ data: { session: renewed }, error: null });
    const replay = jest.spyOn(api, 'request').mockResolvedValue({ data: 'ok' } as never);
    const err = { response: { status: 401 }, config: authed() };

    await expect(rejected(err)).resolves.toEqual({ data: 'ok' });

    expect(replay).toHaveBeenCalledTimes(1);
    expect((replay.mock.calls[0][0] as any).headers.Authorization).toBe('Bearer new-tok');
    expect(useAuthStore.getState().session).toBe(renewed);
    expect(queryClient.getQueryData(['userProfile'])).toEqual({ displayName: 'Old Account' });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('gives up when the replayed request is refused as well', async () => {
    const err = { response: { status: 401 }, config: { ...authed(), _authRetried: true } };

    await expect(rejected(err)).rejects.toBe(err);

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('refreshes only once for a burst of simultaneous 401s', async () => {
    const renewed = { access_token: 'new-tok', refresh_token: 'rt2', user: { id: 'u1' } };
    mockRefresh.mockResolvedValue({ data: { session: renewed }, error: null });
    jest.spyOn(api, 'request').mockResolvedValue({ data: 'ok' } as never);

    await Promise.all([
      rejected({ response: { status: 401 }, config: authed() }),
      rejected({ response: { status: 401 }, config: authed() }),
    ]);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('leaves session and cache alone on non-401 errors', async () => {
    const err = { response: { status: 500 }, config: authed() };

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

    expect(mockRefresh).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBe(fakeSession);
    expect(queryClient.getQueryData(['userProfile'])).toEqual({ displayName: 'Old Account' });
  });
});

/**
 * A ban answers *every* request with 403 `account.suspended`. Signing the person out here would
 * drop them at the phone screen with no explanation and let them straight back in, so the session
 * is kept and the root layout says what happened instead.
 */
describe('api 403 account.suspended interceptor', () => {
  const rejected = (api.interceptors.response as any).handlers
    .map((h: any) => h?.rejected)
    .find(Boolean);

  const fakeSession = { access_token: 'tok', user: { id: 'u1' } } as any;
  const authed = { headers: { Authorization: 'Bearer tok' } };

  beforeEach(() => useAuthStore.setState({ session: fakeSession, suspended: false }));
  afterEach(() => useAuthStore.setState({ session: null, suspended: false }));

  it('flags the account as suspended without clearing the session', async () => {
    const err = { response: { status: 403, data: { code: 'account.suspended' } }, config: authed };

    await expect(rejected(err)).rejects.toBe(err);

    expect(useAuthStore.getState().suspended).toBe(true);
    expect(useAuthStore.getState().session).toBe(fakeSession);
  });

  it('leaves an ordinary 403 alone — most of them are one refused action, not a ban', async () => {
    const err = { response: { status: 403, data: { code: 'match.not_allowed' } }, config: authed };

    await expect(rejected(err)).rejects.toBe(err);

    expect(useAuthStore.getState().suspended).toBe(false);
  });
});
