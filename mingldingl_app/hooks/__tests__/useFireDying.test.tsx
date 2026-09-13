import { renderHook } from '@testing-library/react-native';
import { useFireDying } from '../useFireDying';
import { signal } from '../../lib/world/feedback';

jest.mock('../../lib/world/feedback', () => ({ signal: jest.fn() }));

describe('useFireDying', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fires the dying signal once a thread is first seen at embers', () => {
    renderHook(() => useFireDying('m1', 'embers'));
    expect(signal).toHaveBeenCalledWith('fireDying');
    expect(signal).toHaveBeenCalledTimes(1);
  });

  it('never fires for a fire that is still burning', () => {
    renderHook(() => useFireDying('m1', 'burning'));
    expect(signal).not.toHaveBeenCalled();
  });

  it('does not fire again on a rerender that is still embers', () => {
    const { rerender } = renderHook(({ state }: { state: 'embers' | 'burning' }) => useFireDying('m1', state), {
      initialProps: { state: 'embers' as const },
    });
    expect(signal).toHaveBeenCalledTimes(1);

    rerender({ state: 'embers' });
    expect(signal).toHaveBeenCalledTimes(1);
  });

  it('does not re-fire once a fire moves on to frozen, having already been seen at embers', () => {
    const { rerender } = renderHook<void, { state: 'embers' | 'frozen' }>(
      ({ state }) => useFireDying('m1', state),
      { initialProps: { state: 'embers' } },
    );
    expect(signal).toHaveBeenCalledTimes(1);

    rerender({ state: 'frozen' });
    expect(signal).toHaveBeenCalledTimes(1);
  });

  it('tracks each match separately', () => {
    const { rerender } = renderHook(({ matchId }: { matchId: string }) => useFireDying(matchId, 'embers'), {
      initialProps: { matchId: 'm1' },
    });
    expect(signal).toHaveBeenCalledTimes(1);

    rerender({ matchId: 'm2' });
    expect(signal).toHaveBeenCalledTimes(2);
  });

  it('does nothing without a match id', () => {
    renderHook(() => useFireDying(undefined, 'embers'));
    expect(signal).not.toHaveBeenCalled();
  });
});
