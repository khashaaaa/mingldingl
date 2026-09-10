import { act, renderHook } from '@testing-library/react-native';
import { WAITS, stageAt, useWaitStage, STAGE_TWO_MS, STAGE_THREE_MS, type WaitKind } from '../waiting';
import { translations, AWAITING_MN_TRANSLATION } from '../i18n';

const KINDS: WaitKind[] = ['verifySms', 'quizPartner', 'videoConnect', 'squareRound'];

describe('the wait table', () => {
  it.each(KINDS)('gives %s three stages, starting at 0 and strictly increasing', (kind) => {
    const stages = WAITS[kind];
    expect(stages).toHaveLength(3);
    expect(stages[0].afterMs).toBe(0);
    for (let i = 1; i < stages.length; i++) {
      expect(stages[i].afterMs).toBeGreaterThan(stages[i - 1].afterMs);
    }
  });

  it.each(KINDS)('has an English line for every stage of %s', (kind) => {
    for (const stage of WAITS[kind]) {
      expect(Object.keys(translations.en)).toContain(stage.key);
    }
  });

  // The whole reason stage 1 reuses an existing key: the opening line of every wait is already
  // translated, so a Mongolian speaker never sees English at the moment the wait begins.
  it.each(KINDS)('has a translated first line for %s', (kind) => {
    expect(Object.keys(translations.mn)).toContain(WAITS[kind][0].key);
    expect(AWAITING_MN_TRANSLATION).not.toContain(WAITS[kind][0].key);
  });
});

describe('stageAt', () => {
  it('holds the first stage until the second threshold', () => {
    expect(stageAt('verifySms', 0).index).toBe(0);
    expect(stageAt('verifySms', STAGE_TWO_MS - 1).index).toBe(0);
  });

  it('advances exactly on the threshold', () => {
    expect(stageAt('verifySms', STAGE_TWO_MS).index).toBe(1);
    expect(stageAt('verifySms', STAGE_THREE_MS).index).toBe(2);
  });

  it('stays on the last stage forever after', () => {
    const late = stageAt('verifySms', STAGE_THREE_MS * 100);
    expect(late.index).toBe(2);
    expect(late.isFinal).toBe(true);
  });

  it('marks only the last stage final', () => {
    expect(stageAt('verifySms', 0).isFinal).toBe(false);
  });
});

describe('useWaitStage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('advances through the stages as time passes', () => {
    const { result } = renderHook(() => useWaitStage('verifySms'));
    expect(result.current.index).toBe(0);

    act(() => { jest.advanceTimersByTime(STAGE_TWO_MS); });
    expect(result.current.index).toBe(1);

    act(() => { jest.advanceTimersByTime(STAGE_THREE_MS - STAGE_TWO_MS); });
    expect(result.current.index).toBe(2);
  });

  it('restarts from the first stage when the kind changes', () => {
    const { result, rerender } = renderHook(({ kind }: { kind: WaitKind }) => useWaitStage(kind), {
      initialProps: { kind: 'verifySms' as WaitKind },
    });
    act(() => { jest.advanceTimersByTime(STAGE_THREE_MS); });
    expect(result.current.index).toBe(2);

    rerender({ kind: 'quizPartner' });
    expect(result.current.index).toBe(0);
    expect(result.current.key).toBe(WAITS.quizPartner[0].key);
  });

  it('leaves no timer running after unmount', () => {
    const { unmount } = renderHook(() => useWaitStage('verifySms'));
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
