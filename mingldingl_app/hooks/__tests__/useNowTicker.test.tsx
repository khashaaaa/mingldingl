import { act, renderHook } from '@testing-library/react-native';
import { useNowTicker, NOW_REFRESH_MS } from '../useNowTicker';

describe('useNowTicker', () => {
  afterEach(() => jest.useRealTimers());

  it('reports the current instant at mount', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 12, 9, 0));

    const { result } = renderHook(() => useNowTicker());

    expect(result.current).toBe(new Date(2026, 8, 12, 9, 0).getTime());
  });

  it('only refreshes on the interval, not on every render', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 8, 12, 9, 0));
    const { result } = renderHook(() => useNowTicker());
    const first = result.current;

    // Time has moved on, but nothing has told this hook to look again yet.
    jest.setSystemTime(new Date(2026, 8, 12, 9, 30));
    expect(result.current).toBe(first);

    act(() => { jest.advanceTimersByTime(NOW_REFRESH_MS); });

    // Advancing timers moves the fake clock forward from wherever it already sat.
    expect(result.current).toBe(new Date(2026, 8, 12, 9, 30).getTime() + NOW_REFRESH_MS);
  });

  it('clears the interval on unmount', () => {
    jest.useFakeTimers();
    const clearSpy = jest.spyOn(global, 'clearInterval');

    const { unmount } = renderHook(() => useNowTicker());
    unmount();

    expect(clearSpy).toHaveBeenCalled();
  });
});
