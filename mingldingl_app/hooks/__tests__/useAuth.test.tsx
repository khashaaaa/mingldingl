import { renderHook, act } from '@testing-library/react-native';
import { useAuth, isPhoneValid } from '../useAuth';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../store/authStore';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      setSession: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

const mockSetSession = supabase.auth.setSession as jest.Mock;
const mockSignOut = supabase.auth.signOut as jest.Mock;

function fakeSession(accessToken: string) {
  return { access_token: accessToken, refresh_token: `${accessToken}-refresh`, user: { id: 'u1' } } as any;
}

function mockFetchRoutes(routes: Record<string, { status: number; body: unknown } | 'reject'>) {
  global.fetch = jest.fn((url: unknown) => {
    const path = Object.keys(routes).find((p) => String(url).includes(p));
    const route = path ? routes[path] : undefined;
    if (!route) return Promise.reject(new Error(`no mock route for ${url}`));
    if (route === 'reject') return Promise.reject(new Error('network error'));
    return Promise.resolve({
      ok: route.status >= 200 && route.status < 300,
      status: route.status,
      json: async () => route.body,
    } as Response);
  }) as jest.Mock;
}

describe('isPhoneValid', () => {
  it('accepts exactly 8 digits', () => {
    expect(isPhoneValid('99119911')).toBe(true);
  });

  it('rejects fewer than 8 digits', () => {
    expect(isPhoneValid('9911991')).toBe(false);
  });

  it('rejects more than 8 digits', () => {
    expect(isPhoneValid('991199111')).toBe(false);
  });

  it('rejects non-digit characters', () => {
    expect(isPhoneValid('9911-991')).toBe(false);
    expect(isPhoneValid('abcd1234')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isPhoneValid('')).toBe(false);
  });
});

describe('useAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ session: null });
    mockSetSession.mockResolvedValue({ data: {}, error: null });
  });

  it('rejects a token that is not exactly 6 digits without calling supabase', async () => {
    mockFetchRoutes({});
    const { result } = renderHook(() => useAuth());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.verifyOtp('99119911', '123');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('Enter any 6-digit code');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('surfaces the error and does not set a session when the anonymous sign-in fails', async () => {
    mockFetchRoutes({ '/auth/v1/signup': { status: 400, body: { msg: 'network down' } } });
    const { result } = renderHook(() => useAuth());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.verifyOtp('99119911', '123456');
    });

    expect(ok).toBe(false);
    expect(result.current.error).toBe('That took too long — check your connection and try again');
    expect(result.current.loading).toBe(false);
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('links the phone number, refreshes the session, and stores the refreshed session on success', async () => {
    const original = fakeSession('original-token');
    const refreshed = fakeSession('refreshed-token');
    mockFetchRoutes({
      '/auth/v1/signup': { status: 200, body: original },
      '/auth/v1/user': { status: 200, body: {} },
      '/auth/v1/token': { status: 200, body: refreshed },
    });
    const { result } = renderHook(() => useAuth());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.verifyOtp('99119911', '123456');
    });

    expect(ok).toBe(true);
    const userCall = (global.fetch as jest.Mock).mock.calls.find(([url]: [string]) => url.includes('/auth/v1/user'));
    expect(JSON.parse(userCall[1].body)).toEqual({ data: { phone: '99119911' } });
    expect(useAuthStore.getState().session).toEqual(refreshed);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('stays signed in on the original anonymous session when phone-linking fails (best-effort fallback)', async () => {
    const original = fakeSession('original-token');
    mockFetchRoutes({
      '/auth/v1/signup': { status: 200, body: original },
      '/auth/v1/user': { status: 400, body: { msg: 'phone link failed' } },
    });
    const { result } = renderHook(() => useAuth());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.verifyOtp('99119911', '123456');
    });

    expect(ok).toBe(true);
    expect(result.current.error).toBeNull();
    expect(useAuthStore.getState().session).toEqual(original);
    expect((global.fetch as jest.Mock).mock.calls.some(([url]: [string]) => url.includes('/auth/v1/token'))).toBe(false);
  });

  it('also falls back to the original session when the refresh call itself fails', async () => {
    const original = fakeSession('original-token');
    mockFetchRoutes({
      '/auth/v1/signup': { status: 200, body: original },
      '/auth/v1/user': { status: 200, body: {} },
      '/auth/v1/token': 'reject',
    });
    const { result } = renderHook(() => useAuth());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.verifyOtp('99119911', '123456');
    });

    expect(ok).toBe(true);
    expect(useAuthStore.getState().session).toEqual(original);
  });

  it('sendOtp always resolves true (SMS not configured, any code is accepted)', async () => {
    mockFetchRoutes({});
    const { result } = renderHook(() => useAuth());
    await expect(result.current.sendOtp('99119911')).resolves.toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('signOut calls supabase signOut and clears the local session', async () => {
    useAuthStore.setState({ session: fakeSession('to-be-cleared') });
    mockSignOut.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });
});
