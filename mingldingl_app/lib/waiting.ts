import { useEffect, useMemo, useState } from 'react';

/**
 * What each long wait says, and when it changes its mind.
 *
 * A wait used to be a spinner and one fixed line, which is indistinguishable from a frozen
 * screen once it runs past a few seconds — and the longest wait in the app (texting a code to
 * 144773 and waiting for verify.mn to see it) is also the one where a stuck-looking screen costs
 * the most, because the user has already paid 150₮ to get here.
 *
 * The copy lives in this table rather than at the call sites, exactly as `PushCopy` holds push
 * copy and `world/feedback` holds haptics: adding a wait means adding a row.
 *
 * The first stage of every wait deliberately reuses the key that site already displayed, so no
 * wait's opening line changes and no new Mongolian was needed for it — `videoConnect` is the one
 * exception, and only because its loading branch showed no copy at all.
 */
export type WaitKind = 'verifySms' | 'quizPartner' | 'videoConnect' | 'squareRound';

export interface WaitStage {
  /** Milliseconds since the wait began. The first stage is always 0. */
  readonly afterMs: number;
  /** i18n key for this stage's line. */
  readonly key: string;
}

export interface ActiveStage {
  readonly key: string;
  readonly index: number;
  /** True on the last stage, which is where a caller may offer a way out. */
  readonly isFinal: boolean;
}

export const STAGE_TWO_MS = 8_000;
export const STAGE_THREE_MS = 25_000;

export const WAITS: Record<WaitKind, readonly WaitStage[]> = {
  verifySms: [
    { afterMs: 0, key: 'verify_sms_waiting' },
    { afterMs: STAGE_TWO_MS, key: 'wait_verify_still' },
    { afterMs: STAGE_THREE_MS, key: 'wait_verify_long' },
  ],
  quizPartner: [
    { afterMs: 0, key: 'waiting_match' },
    { afterMs: STAGE_TWO_MS, key: 'wait_quiz_still' },
    { afterMs: STAGE_THREE_MS, key: 'wait_quiz_long' },
  ],
  videoConnect: [
    { afterMs: 0, key: 'waiting_join' },
    { afterMs: STAGE_TWO_MS, key: 'wait_video_still' },
    { afterMs: STAGE_THREE_MS, key: 'wait_video_long' },
  ],
  squareRound: [
    { afterMs: 0, key: 'round_connecting' },
    { afterMs: STAGE_TWO_MS, key: 'wait_square_still' },
    { afterMs: STAGE_THREE_MS, key: 'wait_square_long' },
  ],
};

function describe(kind: WaitKind, index: number): ActiveStage {
  const stages = WAITS[kind];
  return { key: stages[index].key, index, isFinal: index === stages.length - 1 };
}

/** Pure, so the boundaries are testable without a clock. */
export function stageAt(kind: WaitKind, elapsedMs: number): ActiveStage {
  const stages = WAITS[kind];
  let index = 0;
  for (let i = 0; i < stages.length; i++) {
    if (elapsedMs >= stages[i].afterMs) index = i;
  }
  return describe(kind, index);
}

/**
 * The current stage of a wait that began when this hook mounted.
 *
 * One `setTimeout` per remaining stage rather than an interval: nothing here needs to know the
 * elapsed second, only which of three lines to show, and a ticking interval would re-render a
 * waiting screen sixty times for no visible change.
 *
 * This deliberately does NOT consult `useVfxLevel`. Reduce-motion is a request for less
 * movement, not less information — under `still` the lantern stops swinging but the narration
 * still advances, because it is the only thing distinguishing a slow wait from a dead one.
 */
export function useWaitStage(kind: WaitKind): ActiveStage {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
    const timers = WAITS[kind]
      .map((stage, i) => ({ stage, i }))
      .filter(({ stage }) => stage.afterMs > 0)
      .map(({ stage, i }) => setTimeout(() => setIndex(i), stage.afterMs));
    return () => { timers.forEach(clearTimeout); };
  }, [kind]);

  return useMemo(() => describe(kind, index), [kind, index]);
}
