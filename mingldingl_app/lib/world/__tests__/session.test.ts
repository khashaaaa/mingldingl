import { renderHook, act } from '@testing-library/react-native';
import {
  __resetSession,
  getReforgedTint,
  setReforgedTint,
  subscribeToReforgedTint,
  useReforgedTint,
} from '../session';

describe('the session afterglow', () => {
  beforeEach(() => __resetSession());

  it('starts with no tint — a fresh session has not been reforged', () => {
    expect(getReforgedTint()).toBeNull();
  });

  it('holds the colour it is set to, and lets it be cleared', () => {
    setReforgedTint('#2CC46C');
    expect(getReforgedTint()).toBe('#2CC46C');
    setReforgedTint(null);
    expect(getReforgedTint()).toBeNull();
  });

  it('tells subscribers on every change and stops after unsubscribe', () => {
    const listener = jest.fn();
    const unsubscribe = subscribeToReforgedTint(listener);

    setReforgedTint('#427BE2');
    expect(listener).toHaveBeenCalledTimes(1);

    // The same colour again is not a change — nothing should wake for it.
    setReforgedTint('#427BE2');
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setReforgedTint('#EE2B75');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getReforgedTint()).toBe('#EE2B75');
  });

  it('feeds the hook, which re-renders on change', () => {
    const { result } = renderHook(() => useReforgedTint());
    expect(result.current).toBeNull();

    act(() => setReforgedTint('#A855F7'));
    expect(result.current).toBe('#A855F7');

    act(() => setReforgedTint(null));
    expect(result.current).toBeNull();
  });
});
