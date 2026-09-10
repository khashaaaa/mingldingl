import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { activeFestival, useActiveFestival } from '../festivals';

describe('activeFestival', () => {
  it('returns Naadam inside its window, inclusive of both edges', () => {
    expect(activeFestival(new Date(2026, 6, 11, 0, 0))?.key).toBe('naadam-2026');
    expect(activeFestival(new Date(2026, 6, 12, 12, 0))?.key).toBe('naadam-2026');
    expect(activeFestival(new Date(2026, 6, 13, 23, 0))?.key).toBe('naadam-2026');
  });

  it('returns null just outside the Naadam window', () => {
    expect(activeFestival(new Date(2026, 6, 10, 23, 59))).toBeNull();
    expect(activeFestival(new Date(2026, 6, 14, 0, 0))).toBeNull();
  });

  it('returns Tsagaan Sar inside its 2027 window', () => {
    expect(activeFestival(new Date(2027, 1, 7, 0, 0))?.key).toBe('tsagaan-sar-2027');
  });

  it('returns null on an ordinary day', () => {
    expect(activeFestival(new Date(2026, 4, 1, 0, 0))).toBeNull();
  });
});

describe('useActiveFestival', () => {
  let removeSpy: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    removeSpy = jest.fn();
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: removeSpy } as any);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function fireAppState(state: string) {
    // The most recent registration is the hook under test; earlier ones belong to unmounted tests.
    const calls = (AppState.addEventListener as jest.Mock).mock.calls.filter(([event]) => event === 'change');
    const handler = calls[calls.length - 1]?.[1] as (s: string) => void;
    act(() => { handler(state); });
  }

  it('reports the festival on mount', () => {
    jest.setSystemTime(new Date(2026, 6, 12, 9, 0));
    const { result } = renderHook(() => useActiveFestival());
    expect(result.current?.key).toBe('naadam-2026');
  });

  it('re-evaluates when the app comes to the foreground, and unsubscribes on unmount', () => {
    jest.setSystemTime(new Date(2026, 6, 10, 23, 0));
    const { result, unmount } = renderHook(() => useActiveFestival());
    expect(result.current).toBeNull();

    jest.setSystemTime(new Date(2026, 6, 11, 8, 0));
    fireAppState('background');
    expect(result.current).toBeNull();
    fireAppState('active');
    expect(result.current?.key).toBe('naadam-2026');

    unmount();
    expect(removeSpy).toHaveBeenCalled();
  });
});
