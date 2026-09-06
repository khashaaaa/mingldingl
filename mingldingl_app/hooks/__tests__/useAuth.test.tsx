import { AxiosError } from 'axios';
import { renderHook, act } from '@testing-library/react-native';
import { useAuth, isPhoneValid } from '../useAuth';
import { supabase } from '../../lib/supabase';
import { apiClient } from '../../lib/api/apiClient';
import { useAuthStore } from '../../store/authStore';

jest.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      setSession: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: {
    auth: {
      startPhoneVerification: jest.fn(),
      phoneVerificationStatus: jest.fn(),
      claimPhoneVerification: jest.fn(),
    },
    push: { unregister: jest.fn() },
  },
}));

const mockSetSession = supabase.auth.setSession as jest.Mock;
const mockStart = apiClient.auth.startPhoneVerification as jest.Mock;
const mockStatus = apiClient.auth.phoneVerificationStatus as jest.Mock;
const mockClaim = apiClient.auth.claimPhoneVerification as jest.Mock;

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

  it('rejects 7 digits', () => {
    expect(isPhoneValid('9911991')).toBe(false);
  });

  it('rejects 9 digits', () => {
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

describe('useAuth — starting verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ session: null });
    mockSetSession.mockResolvedValue({ data: {}, error: null });
  });

  it('refuses an invalid phone without calling the engine', async () => {
    const { result } = renderHook(() => useAuth());

    let verification: unknown;
    await act(async () => {
      verification = await result.current.startPhoneVerification('123');
    });

    expect(verification).toBeNull();
    expect(result.current.error).toBe('Enter your 8-digit phone number');
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('returns the provider instruction and sms uri on success', async () => {
    mockStart.mockResolvedValue({
      verificationId: 'v1',
      shortcode: '144773',
      smsUri: 'sms:144773?body=482916',
      displayInstruction: 'Та өөрийн 99119911 дугаараас 144773 дугаарт "482916" гэж SMS илгээнэ үү',
      expiresAt: '2999-01-01T00:00:00.000Z',
    });
    const { result } = renderHook(() => useAuth());

    let verification: any;
    await act(async () => {
      verification = await result.current.startPhoneVerification('99119911');
    });

    expect(verification.verificationId).toBe('v1');
    expect(verification.smsUri).toBe('sms:144773?body=482916');
    expect(verification.displayInstruction).toContain('144773');
    expect(result.current.error).toBeNull();
  });

  it('resumes the session a number was last given instead of opening a second one', async () => {
    mockStart.mockResolvedValue({ verificationId: 'v-first', smsUri: 'sms:144773?body=1', displayInstruction: 'x' });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.startPhoneVerification('88118811');
    });
    expect(mockStart).toHaveBeenLastCalledWith('88118811', undefined);

    await act(async () => {
      await result.current.startPhoneVerification('88118811');
    });
    expect(mockStart).toHaveBeenLastCalledWith('88118811', 'v-first');

    // A different number never inherits another number's session.
    await act(async () => {
      await result.current.startPhoneVerification('88118822');
    });
    expect(mockStart).toHaveBeenLastCalledWith('88118822', undefined);
  });

  it('shows the localised copy for an engine error code when a session cannot be opened', async () => {
    const tooMany = new AxiosError('429');
    tooMany.response = { status: 429, data: { error: 'too many', code: 'phone.too_many_attempts' } } as AxiosError['response'];
    mockStart.mockRejectedValue(tooMany);
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.startPhoneVerification('88118833');
    });

    expect(result.current.error).toBe('Too many attempts for this number. Wait a few minutes before trying again.');
  });

  it('surfaces an error when the engine cannot open a session', async () => {
    mockStart.mockRejectedValue(new Error('503'));
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.startPhoneVerification('99119911');
    });

    expect(result.current.error).toBe("Couldn't start verification — check your connection and try again");
    expect(result.current.loading).toBe(false);
  });

  it('clearError resets a stale message', async () => {
    const { result } = renderHook(() => useAuth());
    await act(async () => {
      await result.current.startPhoneVerification('123');
    });
    expect(result.current.error).not.toBeNull();

    act(() => result.current.clearError());
    expect(result.current.error).toBeNull();
  });
});

describe('useAuth — polling verification status', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['Pending', 'pending'],
    ['Verified', 'verified'],
    ['Expired', 'expired'],
  ])('maps engine status %s to %s', async (status, expected) => {
    mockStatus.mockResolvedValue({ status });
    const { result } = renderHook(() => useAuth());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.checkVerification('v1');
    });

    expect(outcome).toBe(expected);
  });

  it('reports an error outcome when the status call fails', async () => {
    mockStatus.mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useAuth());

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.checkVerification('v1');
    });

    expect(outcome).toBe('error');
  });
});

describe('useAuth — completing sign-in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ session: null });
    mockSetSession.mockResolvedValue({ data: {}, error: null });
    (supabase.auth.signOut as jest.Mock).mockResolvedValue({ error: null });
  });

  it('stores the refreshed session once the phone is claimed', async () => {
    const original = fakeSession('original-token');
    const refreshed = fakeSession('refreshed-token');
    mockFetchRoutes({
      '/auth/v1/signup': { status: 200, body: original },
      '/auth/v1/user': { status: 200, body: {} },
      '/auth/v1/token': { status: 200, body: refreshed },
    });
    mockClaim.mockResolvedValue({ phone: '99119911' });
    const { result } = renderHook(() => useAuth());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.completeSignIn('v1', '99119911');
    });

    expect(ok).toBe(true);
    expect(mockClaim).toHaveBeenCalledWith('v1', 'refreshed-token');
    expect(useAuthStore.getState().session?.access_token).toBe('refreshed-token');
  });

  // The engine only resolves this anonymous identity onto the real account once the claim binds
  // it. Handing the session to the app first let every session-gated query fire against an
  // account the engine could not see yet: /users/me 404'd, and the returning user was routed
  // into onboarding behind a "No such traveler" alert.
  it('claims the phone before any session reaches the app', async () => {
    const original = fakeSession('original-token');
    const refreshed = fakeSession('refreshed-token');
    mockFetchRoutes({
      '/auth/v1/signup': { status: 200, body: original },
      '/auth/v1/user': { status: 200, body: {} },
      '/auth/v1/token': { status: 200, body: refreshed },
    });
    const order: string[] = [];
    mockClaim.mockImplementation(async () => {
      order.push('claim');
      expect(useAuthStore.getState().session).toBeNull();
      return { phone: '99119911' };
    });
    mockSetSession.mockImplementation(async () => { order.push('setSession'); return { data: {}, error: null }; });
    const { result } = renderHook(() => useAuth());

    await act(async () => { await result.current.completeSignIn('v1', '99119911'); });

    expect(order).toEqual(['claim', 'setSession']);
    expect(useAuthStore.getState().session?.access_token).toBe('refreshed-token');
  });

  it('does not set a session when the anonymous sign-up fails', async () => {
    mockFetchRoutes({ '/auth/v1/signup': { status: 400, body: { msg: 'network down' } } });
    const { result } = renderHook(() => useAuth());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.completeSignIn('v1', '99119911');
    });

    expect(ok).toBe(false);
    expect(mockClaim).not.toHaveBeenCalled();
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('never hands over the session when the claim is rejected', async () => {
    const original = fakeSession('original-token');
    mockFetchRoutes({
      '/auth/v1/signup': { status: 200, body: original },
      '/auth/v1/user': { status: 200, body: {} },
      '/auth/v1/token': { status: 200, body: original },
    });
    mockClaim.mockRejectedValue(new Error('409'));
    const { result } = renderHook(() => useAuth());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.completeSignIn('v1', '99119911');
    });

    expect(ok).toBe(false);
    expect(mockSetSession).not.toHaveBeenCalled();
    expect(result.current.error).toBe("We couldn't finish signing you in. Please try again.");
    expect(useAuthStore.getState().session).toBeNull();
  });

  it('still signs in when linking the phone metadata fails, since the claim is what counts', async () => {
    const original = fakeSession('original-token');
    mockFetchRoutes({
      '/auth/v1/signup': { status: 200, body: original },
      '/auth/v1/user': 'reject',
      '/auth/v1/token': { status: 200, body: original },
    });
    mockClaim.mockResolvedValue({ phone: '99119911' });
    const { result } = renderHook(() => useAuth());

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.completeSignIn('v1', '99119911');
    });

    expect(ok).toBe(true);
    expect(useAuthStore.getState().session?.access_token).toBe('original-token');
  });

  it('ignores a concurrent second call so one verification cannot mint two sessions', async () => {
    const original = fakeSession('original-token');
    mockFetchRoutes({
      '/auth/v1/signup': { status: 200, body: original },
      '/auth/v1/user': { status: 200, body: {} },
      '/auth/v1/token': { status: 200, body: original },
    });
    mockClaim.mockResolvedValue({ phone: '99119911' });
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await Promise.all([
        result.current.completeSignIn('v1', '99119911'),
        result.current.completeSignIn('v1', '99119911'),
      ]);
    });

    expect(mockClaim).toHaveBeenCalledTimes(1);
  });
});
