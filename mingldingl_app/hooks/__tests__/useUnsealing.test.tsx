import { act, renderHook } from '@testing-library/react-native';
import { useUnsealing } from '../useUnsealing';

describe('useUnsealing', () => {
  it('says nothing about a match it is seeing for the first time', () => {
    // Opening a chat that is already at level 3 must not replay a ceremony earned days ago.
    const { result } = renderHook(() => useUnsealing('m1', 3));
    expect(result.current.unsealed).toBe(false);
  });

  it('fires when the level climbs while the screen is open', () => {
    const { result, rerender } = renderHook(
      ({ level }) => useUnsealing('m1', level),
      { initialProps: { level: 1 } },
    );
    expect(result.current.unsealed).toBe(false);
    rerender({ level: 2 });
    expect(result.current.unsealed).toBe(true);
  });

  it('stays quiet when the level holds or drops', () => {
    const { result, rerender } = renderHook(
      ({ level }) => useUnsealing('m1', level),
      { initialProps: { level: 3 } },
    );
    rerender({ level: 3 });
    expect(result.current.unsealed).toBe(false);
    rerender({ level: 2 });
    expect(result.current.unsealed).toBe(false);
  });

  it('does not compare one match against another', () => {
    // Walking from a level-1 chat into a level-4 chat is navigation, not a reveal.
    const { result, rerender } = renderHook(
      ({ id, level }) => useUnsealing(id, level),
      { initialProps: { id: 'm1', level: 1 } },
    );
    rerender({ id: 'm2', level: 4 });
    expect(result.current.unsealed).toBe(false);
    rerender({ id: 'm2', level: 5 });
    expect(result.current.unsealed).toBe(true);
  });

  it('waits for a level to arrive rather than treating undefined as zero', () => {
    const { result, rerender } = renderHook(
      ({ level }) => useUnsealing('m1', level),
      { initialProps: { level: undefined as number | undefined } },
    );
    rerender({ level: 3 });
    expect(result.current.unsealed).toBe(false);
  });

  it('can be dismissed and re-armed for the next rung', () => {
    const { result, rerender } = renderHook(
      ({ level }) => useUnsealing('m1', level),
      { initialProps: { level: 1 } },
    );
    rerender({ level: 2 });
    expect(result.current.unsealed).toBe(true);
    act(() => result.current.dismiss());
    expect(result.current.unsealed).toBe(false);
    rerender({ level: 3 });
    expect(result.current.unsealed).toBe(true);
  });
});
