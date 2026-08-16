import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, act } from '@testing-library/react-native';
import { useOnboarding } from '../useOnboarding';
import { apiClient } from '../../lib/api/apiClient';
import { queryKeys } from '../../lib/api/queryKeys';
import { useAuthStore } from '../../store/authStore';

// Factory form, not the bare `jest.mock('../../lib/api/apiClient')` automock —
// the automock still has to load the real module once to introspect its
// shape, which cascades through lib/api.ts into lib/supabase.ts's real
// createClient() call at module scope and throws on the missing
// EXPO_PUBLIC_SUPABASE_URL env var in the test environment. A factory skips
// loading the real module entirely.
jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { users: { upsert: jest.fn() } },
}));

const mockUpsert = apiClient.users.upsert as jest.Mock;

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

// Fills in every field the completeness check requires; tests override one
// field at a time to prove each is actually load-bearing.
function fillComplete(result: { current: ReturnType<typeof useOnboarding> }) {
  act(() => {
    result.current.update({ displayName: 'Bat', age: 25, gender: 'Male', city: 'Ulaanbaatar', bio: 'hello there' });
    result.current.updatePhotos(['a.jpg', 'b.jpg', 'c.jpg']);
  });
}

describe('useOnboarding completeness check', () => {
  it('is incomplete on the initial state', () => {
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    expect(result.current.isComplete).toBe(false);
  });

  it('is complete once all five fields are filled', () => {
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
      photoUrls: ['a.jpg', 'b.jpg', 'c.jpg'], latitude: 47.9, longitude: 106.9,
    });
    const cached = queryClient.getQueryData(queryKeys.userProfile) as { id: string; displayName: string };
    expect(cached.id).toBe('u1');
    expect(cached.displayName).toBe('Bat');
    expect(result.current.state.loading).toBe(false);
    expect(result.current.state.error).toBeNull();
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
    // The critical regression this guards against: app/_layout.tsx routes
    // purely off `!!userProfile` in the query cache, so a fake profile
    // written here on failure would route the user into the main app with
    // no server-side row behind it.
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

  it('on success, sets pendingDrop when the response carries a referralRewardItem', async () => {
    mockUpsert.mockResolvedValue({
      id: 'u1',
      referralRewardItem: { nameKey: 'item_title_wanderer', rarity: 'Common' },
    });
    const queryClient = new QueryClient();
    const { result } = renderHook(() => useOnboarding(), { wrapper: makeWrapper(queryClient) });
    fillComplete(result);

    await act(async () => {
      await result.current.submit();
    });

    expect(useAuthStore.getState().pendingDrop).toEqual({ nameKey: 'item_title_wanderer', rarity: 'Common' });
  });

  it('on success, leaves pendingDrop untouched when no referralRewardItem is present', async () => {
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
