import {
  hydrateRevealThresholds,
  nextRevealThreshold,
  deepProfileThreshold,
  areRevealThresholdsHydrated,
  resetRevealThresholdsForTests,
  subscribeToRevealThresholds,
  revealLadderSnapshot,
} from '../reveal';

describe('reveal ladder', () => {
  beforeEach(() => resetRevealThresholdsForTests());

  it.each([[0, 5], [4, 5], [5, 15], [14, 15], [15, 30], [29, 30], [30, null], [100, null]])(
    'before hydration, messageCount %i → next reveal at %p (the shipped defaults)', (count, expected) => {
      expect(nextRevealThreshold(count)).toBe(expected);
      expect(areRevealThresholdsHydrated()).toBe(false);
    });

  it('deep profile unlocks at the level-4 default before hydration', () => {
    expect(deepProfileThreshold()).toBe(30);
  });

  it('follows the engine ladder once hydrated', () => {
    hydrateRevealThresholds([
      { level: 1, messages: 1 }, { level: 2, messages: 7 }, { level: 3, messages: 20 }, { level: 4, messages: 40 },
    ]);

    expect(areRevealThresholdsHydrated()).toBe(true);
    expect(nextRevealThreshold(0)).toBe(7);
    expect(nextRevealThreshold(7)).toBe(20);
    expect(nextRevealThreshold(39)).toBe(40);
    expect(nextRevealThreshold(40)).toBeNull();
    expect(deepProfileThreshold()).toBe(40);
  });

  it('ignores a malformed ladder and keeps the defaults', () => {
    hydrateRevealThresholds([{ level: 2, messages: 7 }]);

    expect(areRevealThresholdsHydrated()).toBe(false);
    expect(nextRevealThreshold(0)).toBe(5);
  });

  describe('subscription', () => {
    it('notifies subscribers when hydration changes the ladder', () => {
      const seen: number[][] = [];
      subscribeToRevealThresholds(() => seen.push(revealLadderSnapshot()));

      hydrateRevealThresholds([
        { level: 1, messages: 1 }, { level: 2, messages: 7 }, { level: 3, messages: 20 }, { level: 4, messages: 40 },
      ]);

      expect(seen).toEqual([[1, 7, 20, 40]]);
    });

    it('does not notify when the engine ladder matches what is already loaded', () => {
      const onChange = jest.fn();
      subscribeToRevealThresholds(onChange);

      const same = [
        { level: 1, messages: 1 }, { level: 2, messages: 5 }, { level: 3, messages: 15 }, { level: 4, messages: 30 },
      ];
      hydrateRevealThresholds(same);
      hydrateRevealThresholds(same);

      expect(onChange).not.toHaveBeenCalled();
      expect(areRevealThresholdsHydrated()).toBe(true);
    });

    it('stops notifying once unsubscribed', () => {
      const onChange = jest.fn();
      subscribeToRevealThresholds(onChange)();

      hydrateRevealThresholds([
        { level: 1, messages: 1 }, { level: 2, messages: 9 }, { level: 3, messages: 20 }, { level: 4, messages: 40 },
      ]);

      expect(onChange).not.toHaveBeenCalled();
    });

    it('keeps the snapshot reference stable between hydrations, so useSyncExternalStore settles', () => {
      const before = revealLadderSnapshot();
      expect(revealLadderSnapshot()).toBe(before);

      hydrateRevealThresholds([
        { level: 1, messages: 1 }, { level: 2, messages: 7 }, { level: 3, messages: 20 }, { level: 4, messages: 40 },
      ]);
      const after = revealLadderSnapshot();

      expect(after).not.toBe(before);
      expect(revealLadderSnapshot()).toBe(after);
    });
  });
});
