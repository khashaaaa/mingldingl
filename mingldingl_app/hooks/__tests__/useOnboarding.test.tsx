import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react-native';
import { useOnboarding } from '../useOnboarding';
import { apiClient } from '../../lib/api/apiClient';
import { queryKeys } from '../../lib/api/queryKeys';
import { useAuthStore } from '../../store/authStore';

jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { users: { upsert: jest.fn(), swearOath: jest.fn() } },
}));

const mockUpsert = apiClient.users.upsert as jest.Mock;
const mockSwearOath = apiClient.users.swearOath as jest.Mock;

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function fillComplete(result: { current: ReturnType<typeof useOnboarding> }) {
  act(() => {
    result.current.update({
      displayName: 'Bat', age: 25, gender: 'Male', city: 'Ulaanbaatar', bio: 'hello there', oath: 'Bond',
    });
    result.current.updatePhotos(['a.jpg', 'b.jpg', 'c.jpg']);
  });
}

describe('useOnboarding completeness check', () => {
  it('is incomplete on the initial state', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    expect(result.current.isComplete).toBe(false);
  });

  it('is complete once all fields, including the oath, are filled', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);
    expect(result.current.isComplete).toBe(true);
  });

  it('requires a non-empty displayName', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);
    act(() => result.current.update({ displayName: '' }));
    expect(result.current.isComplete).toBe(false);
  });

  it('requires age greater than 0', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);
    act(() => result.current.update({ age: 0 }));
    expect(result.current.isComplete).toBe(false);
  });

  it('requires a non-empty gender', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);
    act(() => result.current.update({ gender: '' }));
    expect(result.current.isComplete).toBe(false);
  });

  it('requires a non-empty city', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);
    act(() => result.current.update({ city: '' }));
    expect(result.current.isComplete).toBe(false);
  });

  it('requires a non-empty bio', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);
    act(() => result.current.update({ bio: '' }));
    expect(result.current.isComplete).toBe(false);
  });

  it('requires a sworn oath', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);
    act(() => result.current.update({ oath: null }));
    expect(result.current.isComplete).toBe(false);
  });

  it('requires at least 3 photos, exactly 2 is not enough', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);
    act(() => result.current.updatePhotos(['a.jpg', 'b.jpg']));
    expect(result.current.isComplete).toBe(false);
  });

  it('updatePhotos accepts an updater function against the current list', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    act(() => result.current.updatePhotos(['a.jpg']));
    act(() => result.current.updatePhotos((current) => [...current, 'b.jpg']));
    expect(result.current.state.photoUrls).toEqual(['a.jpg', 'b.jpg']);
  });

  it('nextStep/prevStep move the step and prevStep never goes below 0', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    act(() => result.current.prevStep());
    expect(result.current.state.currentStep).toBe(0);
    act(() => result.current.nextStep());
    act(() => result.current.nextStep());
    expect(result.current.state.currentStep).toBe(2);
    act(() => result.current.prevStep());
    expect(result.current.state.currentStep).toBe(1);
  });
});

describe('useOnboarding submit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ pendingDrop: null });
  });

  it('does not call the API and returns false when the profile is incomplete', async () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submit();
    });

    expect(ok).toBe(false);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('on success, posts the collected fields, caches the parsed profile, and returns true', async () => {
    mockUpsert.mockResolvedValue({ id: 'u1', displayName: 'Bat', isProfileComplete: true });
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);
    act(() => result.current.update({ latitude: 47.9, longitude: 106.9 }));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submit();
    });

    expect(ok).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith({
      displayName: 'Bat', age: 25, gender: 'Male', city: 'Ulaanbaatar', bio: 'hello there',
      photoUrls: ['a.jpg', 'b.jpg', 'c.jpg'], latitude: 47.9, longitude: 106.9, preferredLocale: 'en',
    });
    const cached = queryClient.getQueryData(queryKeys.userProfile) as { id: string; displayName: string };
    expect(cached.id).toBe('u1');
    expect(cached.displayName).toBe('Bat');
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBeNull();
  });

  it('on success, also swears the collected oath — a separate call, never folded into the upsert body', async () => {
    mockUpsert.mockResolvedValue({ id: 'u1', displayName: 'Bat' });
    mockSwearOath.mockResolvedValue({ id: 'u1', displayName: 'Bat', oath: 'Bond', oathProven: false });
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(mockSwearOath).toHaveBeenCalledWith('Bond');
    expect(mockUpsert.mock.calls[0][0]).not.toHaveProperty('oath');
    const cached = queryClient.getQueryData(queryKeys.userProfile) as { oath: string | null; oathProven: boolean };
    expect(cached.oath).toBe('Bond');
    expect(cached.oathProven).toBe(false);
  });

  it('omits latitude/longitude from the request when they were never captured', async () => {
    mockUpsert.mockResolvedValue({ id: 'u1' });
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ latitude: undefined, longitude: undefined }));
  });

  it('on a server rejection, surfaces an error and does NOT fabricate a cached profile', async () => {
    mockUpsert.mockRejectedValue(new Error('500 validation failed'));
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.submit();
    });

    expect(ok).toBe(false);
    expect(result.current.state.error).toBe("Your words didn't reach the scribe. Try again.");
    expect(result.current.state.loading).toBe(false);

    expect(queryClient.getQueryData(queryKeys.userProfile)).toBeUndefined();
  });

  it('resets loading to true then false around the submit call, even on failure', async () => {
    let resolveUpsert!: (v: unknown) => void;
    mockUpsert.mockReturnValue(new Promise((resolve) => { resolveUpsert = resolve; }));
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);

    let submitPromise!: Promise<boolean>;
    act(() => {
      submitPromise = result.current.submit();
    });
    expect(result.current.state.loading).toBe(true);

    await act(async () => {
      resolveUpsert({ id: 'u1' });
      await submitPromise;
    });
    expect(result.current.state.loading).toBe(false);
  });

  it('includes referralCode in the request when one was entered', async () => {
    mockUpsert.mockResolvedValue({ id: 'u1' });
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);
    act(() => result.current.update({ referralCode: 'FOX392' }));

    await act(async () => {
      await result.current.submit();
    });

    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ referralCode: 'FOX392' }));
  });

  it('sends the app locale so pushes arrive in the language the user onboarded in', async () => {
    const { i18n } = jest.requireActual('../../lib/i18n');
    i18n.locale = 'mn';
    mockUpsert.mockResolvedValue({ id: 'u1' });
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(new QueryClient()) });
    fillComplete(result);

    await act(async () => { await result.current.submit(); });

    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ preferredLocale: 'mn' }));
    i18n.locale = 'en';
  });

  it('omits referralCode from the request when none was entered', async () => {
    mockUpsert.mockResolvedValue({ id: 'u1' });
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({ referralCode: undefined }));
  });

  it('on success, never touches pendingDrop — the recruit reward belongs to the inviter, not the newcomer', async () => {
    useAuthStore.setState({ pendingDrop: null });
    mockUpsert.mockResolvedValue({ id: 'u1' });
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(useAuthStore.getState().pendingDrop).toBeNull();
  });
});
