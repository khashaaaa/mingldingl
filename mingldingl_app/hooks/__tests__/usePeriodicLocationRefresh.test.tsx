import { AppState } from 'react-native';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { usePeriodicLocationRefresh } from '../usePeriodicLocationRefresh';
import * as Location from 'expo-location';
import { apiClient } from '../../lib/api/apiClient';

// Factory form, not the bare `jest.mock('../../lib/api/apiClient')` automock —
// the automock still has to load the real module once to introspect its
// shape, which cascades through lib/api.ts into lib/supabase.ts's real
// createClient() call at module scope and throws on the missing
// EXPO_PUBLIC_SUPABASE_URL env var in the test environment. A factory skips
// loading the real module entirely.
jest.mock('../../lib/api/apiClient', () => ({
  apiClient: { users: { updateLocation: jest.fn() } },
}));
jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  PermissionStatus: { GRANTED: 'granted' },
  Accuracy: { Balanced: 3 },
}));

const mockGetPermissions = Location.getForegroundPermissionsAsync as jest.Mock;
const mockGetPosition = Location.getCurrentPositionAsync as jest.Mock;
const mockUpdateLocation = apiClient.users.updateLocation as jest.Mock;

// AppState's real RN mock in tests doesn't drive listeners on its own —
// capture the registered handler ourselves and invoke it directly to
// simulate a foreground transition, mirroring how the hook itself only
// reacts to the 'change' event with state === 'active'.
function captureAppStateHandler(): (state: string) => void {
  const addSpy = jest.spyOn(AppState, 'addEventListener');
  return (state: string) => {
    const call = addSpy.mock.calls.find(([event]) => event === 'change');
    (call?.[1] as (s: string) => void)?.(state);
  };
}

describe('usePeriodicLocationRefresh', () => {
  let removeSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1_000_000_000_000);
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetPosition.mockResolvedValue({ coords: { latitude: 47.9, longitude: 106.9 } });
    mockUpdateLocation.mockResolvedValue(undefined);
    removeSpy = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: removeSpy } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing at all when disabled', async () => {
    renderHook(() => usePeriodicLocationRefresh(false));
    await new Promise((r) => setTimeout(r, 0));
    expect(mockGetPermissions).not.toHaveBeenCalled();
    expect(AppState.addEventListener).not.toHaveBeenCalled();
  });

  it('refreshes once immediately on mount when enabled', async () => {
    renderHook(() => usePeriodicLocationRefresh(true));
    await waitFor(() => expect(mockUpdateLocation).toHaveBeenCalledWith(47.9, 106.9));
  });

  it('does not (re-)request permission — a not-granted status just no-ops', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'undetermined' });
    renderHook(() => usePeriodicLocationRefresh(true));
    await waitFor(() => expect(mockGetPermissions).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(mockGetPosition).not.toHaveBeenCalled();
    expect(mockUpdateLocation).not.toHaveBeenCalled();
  });

  it('is best-effort: a GPS/network failure does not throw or crash the effect', async () => {
    mockGetPosition.mockRejectedValue(new Error('GPS unavailable'));
    renderHook(() => usePeriodicLocationRefresh(true));
    await waitFor(() => expect(mockGetPosition).toHaveBeenCalled());
    expect(mockUpdateLocation).not.toHaveBeenCalled();
  });

  it('throttles: an app-active transition within 6 hours of the last refresh does not refresh again', async () => {
    renderHook(() => usePeriodicLocationRefresh(true));
    await waitFor(() => expect(mockUpdateLocation).toHaveBeenCalledTimes(1));

    const fireAppStateChange = captureAppStateHandler();
    // Just under 6 hours later.
    (Date.now as jest.Mock).mockReturnValue(1_000_000_000_000 + 1000 * 60 * 60 * 6 - 1);
    await act(async () => {
      fireAppStateChange('active');
      await Promise.resolve();
    });

    expect(mockUpdateLocation).toHaveBeenCalledTimes(1);
  });

  it('refreshes again once a full 6 hours has elapsed since the last refresh, on an app-active transition', async () => {
    renderHook(() => usePeriodicLocationRefresh(true));
    await waitFor(() => expect(mockUpdateLocation).toHaveBeenCalledTimes(1));

    const fireAppStateChange = captureAppStateHandler();
    (Date.now as jest.Mock).mockReturnValue(1_000_000_000_000 + 1000 * 60 * 60 * 6);
    mockGetPosition.mockResolvedValue({ coords: { latitude: 48, longitude: 107 } });
    await act(async () => {
      fireAppStateChange('active');
      await Promise.resolve();
    });
    await waitFor(() => expect(mockUpdateLocation).toHaveBeenCalledTimes(2));
    expect(mockUpdateLocation).toHaveBeenLastCalledWith(48, 107);
  });

  it('ignores app-state transitions to background/inactive — only "active" triggers a refresh check', async () => {
    renderHook(() => usePeriodicLocationRefresh(true));
    await waitFor(() => expect(mockUpdateLocation).toHaveBeenCalledTimes(1));

    const fireAppStateChange = captureAppStateHandler();
    (Date.now as jest.Mock).mockReturnValue(1_000_000_000_000 + 1000 * 60 * 60 * 24);
    await act(async () => {
      fireAppStateChange('background');
      fireAppStateChange('inactive');
      await Promise.resolve();
    });

    expect(mockUpdateLocation).toHaveBeenCalledTimes(1);
  });

  it('removes the AppState listener on unmount', async () => {
    const { unmount } = renderHook(() => usePeriodicLocationRefresh(true));
    await waitFor(() => expect(mockUpdateLocation).toHaveBeenCalledTimes(1));

    unmount();
    expect(removeSpy).toHaveBeenCalled();
  });

  it('re-arms a fresh mount-time refresh when toggled from disabled to enabled', async () => {
    const { rerender } = renderHook(({ enabled }) => usePeriodicLocationRefresh(enabled), {
      initialProps: { enabled: false },
    });
    expect(mockUpdateLocation).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(mockUpdateLocation).toHaveBeenCalledTimes(1));
  });
});
