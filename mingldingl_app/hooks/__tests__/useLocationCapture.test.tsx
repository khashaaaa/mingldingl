import { renderHook, act } from '@testing-library/react-native';
import { useLocationCapture } from '../useLocationCapture';
import * as Location from 'expo-location';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

const mockRequestPermission = Location.requestForegroundPermissionsAsync as jest.Mock;
const mockGetPosition = Location.getCurrentPositionAsync as jest.Mock;

describe('useLocationCapture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('starts with permissionDenied false and isCapturing false', () => {
    const { result } = renderHook(() => useLocationCapture());
    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.isCapturing).toBe(false);
  });

  it('returns coords and clears permissionDenied on a successful capture', async () => {
    mockRequestPermission.mockResolvedValue({ granted: true });
    mockGetPosition.mockResolvedValue({ coords: { latitude: 47.9, longitude: 106.9 } });
    const { result } = renderHook(() => useLocationCapture());

    let coords: { latitude: number; longitude: number } | null = null;
    await act(async () => {
      coords = await result.current.capture();
    });

    expect(coords).toEqual({ latitude: 47.9, longitude: 106.9 });
    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.isCapturing).toBe(false);
  });

  it('sets permissionDenied and returns null when the permission prompt is declined', async () => {
    mockRequestPermission.mockResolvedValue({ granted: false });
    const { result } = renderHook(() => useLocationCapture());

    let coords: unknown = 'unset';
    await act(async () => {
      coords = await result.current.capture();
    });

    expect(coords).toBeNull();
    expect(result.current.permissionDenied).toBe(true);
    expect(mockGetPosition).not.toHaveBeenCalled();
  });

  it('unifies a GPS/OS-level failure into the same permissionDenied state as an explicit denial', async () => {
    mockRequestPermission.mockResolvedValue({ granted: true });
    mockGetPosition.mockRejectedValue(new Error('Location services are disabled'));
    const { result } = renderHook(() => useLocationCapture());

    let coords: unknown = 'unset';
    await act(async () => {
      coords = await result.current.capture();
    });

    expect(coords).toBeNull();
    expect(result.current.permissionDenied).toBe(true);
  });

  it('clears a previous permissionDenied once a later capture succeeds', async () => {
    mockRequestPermission.mockResolvedValueOnce({ granted: false });
    const { result } = renderHook(() => useLocationCapture());
    await act(async () => {
      await result.current.capture();
    });
    expect(result.current.permissionDenied).toBe(true);

    mockRequestPermission.mockResolvedValueOnce({ granted: true });
    mockGetPosition.mockResolvedValue({ coords: { latitude: 1, longitude: 2 } });
    await act(async () => {
      await result.current.capture();
    });

    expect(result.current.permissionDenied).toBe(false);
  });

  it('requests Balanced accuracy, not Highest', async () => {
    mockRequestPermission.mockResolvedValue({ granted: true });
    mockGetPosition.mockResolvedValue({ coords: { latitude: 1, longitude: 2 } });
    const { result } = renderHook(() => useLocationCapture());

    await act(async () => {
      await result.current.capture();
    });

    expect(mockGetPosition).toHaveBeenCalledWith({ accuracy: Location.Accuracy.Balanced });
  });

  it('toggles isCapturing true during the call and false afterward, even on failure', async () => {
    let resolvePermission!: (v: { granted: boolean }) => void;
    mockRequestPermission.mockReturnValue(new Promise((resolve) => { resolvePermission = resolve; }));
    const { result } = renderHook(() => useLocationCapture());

    let capturePromise!: Promise<unknown>;
    act(() => {
      capturePromise = result.current.capture();
    });
    expect(result.current.isCapturing).toBe(true);

    await act(async () => {
      resolvePermission({ granted: false });
      await capturePromise;
    });
    expect(result.current.isCapturing).toBe(false);
  });
});
