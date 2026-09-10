# The Waiting Vocabulary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ~30 identical `ActivityIndicator`s with a themed wait vocabulary — an inline
waiter, content-shaped skeletons, and narrated long-wait scenes — plus a list-entrance stagger, a
visible in-flight message state, and three style-consistency fixes.

**Architecture:** One table (`lib/waiting.ts`) owns which line each wait shows at which elapsed
time, exactly as `Services/PushCopy.cs` owns push copy and `lib/world/feedback.ts` owns haptics.
Three presentational components consume it. Migration runs in three waves ordered by payoff, each
independently verifiable on device.

**Tech Stack:** React Native 0.81 + Expo ~54, RN `Animated` (not Reanimated — see Global
Constraints), `expo-linear-gradient`, MaterialCommunityIcons via `components/ui/Icon`, Jest +
`@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-09-10-waiting-vocabulary-design.md`

## Global Constraints

- **Plain RN `Animated` only.** No Reanimated, no Skia, no `react-native-svg` (not installed).
  Reanimated and Skia are reserved for `components/vfx/` and `components/world/`; every UI
  component (`XPBar`, `GameButton`, `Lantern`, `TierUpCeremony`) uses RN `Animated`. `TorchGlow`
  is the one vfx component these components may use, because it resolves all four vfx levels
  internally.
- **Every effect needs a `still` form.** Read the level with `useVfxLevel()` and gate loops with
  `motionAllowed(level)` from `lib/vfx.ts`. Start no loop when motion is not allowed, and stop
  every loop on unmount.
- **The scene goes still; the narration does not.** Under `still`, skeletons hold a flat opacity
  and the lantern stops swinging, but staged copy still advances on schedule. `useWaitStage` must
  never read the vfx level.
- **One loop, not N.** Follow `Lantern`'s rule — "seven glows would be seven canvases for one
  light." Fifteen skeleton blocks share one pulse.
- **No AI-guessed Mongolian.** House rule in `lib/i18n/index.ts`. New keys go in `en.ts` only and
  onto `AWAITING_MN_TRANSLATION`; Task 12 takes them off once translations arrive.
- **Design tokens only.** Colours from `COLORS`/`tint()`, spacing from `SPACE`, radii from
  `RADIUS`, sizes from `ICON_SIZES`/`FONT_SIZES`, fonts from `FONTS` — all in `lib/theme.ts`. No
  raw hex, no `rgba(` literals, no numeric spacing except `0`.
- **Screen containers stay `backgroundColor: 'transparent'`** so the world floor laid inside
  `ScreenGround` shows through.
- **Commands:** `npm run typecheck` (never bare `npx tsc`), `npm test`.

---

## File Structure

**Create**
| File | Responsibility |
|---|---|
| `lib/waiting.ts` | The wait table, the pure `stageAt`, the `useWaitStage` hook |
| `lib/__tests__/waiting.test.ts` | Stage boundaries, table integrity, timer cleanup |
| `components/ui/Waiting.tsx` | Inline waiter — a rotating tinted knot |
| `components/ui/__tests__/Waiting.test.tsx` | Loop gating per vfx level |
| `components/ui/Skeleton.tsx` | `Skeleton` primitive, `SkeletonRows`, the shared pulse |
| `components/ui/__tests__/Skeleton.test.tsx` | Shape, row count, pulse gating |
| `components/ui/LongWait.tsx` | `WaitLantern` scene + narrated wait |
| `components/ui/__tests__/LongWait.test.tsx` | Narration advances, incl. under `still` |
| `components/ui/Entering.tsx` | First-mount staggered list-row entrance |
| `components/ui/__tests__/Entering.test.tsx` | Staggers by index, at rest under `still` |

**Modify** — `lib/i18n/en.ts`, `lib/i18n/index.ts` (9 keys — the spec's 8, plus `quiz_answers_in`
which Task 5 needs once `LongWait` takes over the quiz screen's `waiting_match` line), the four long-wait screens (Task 5),
ten list screens (Task 6), twelve inline sites (Task 7), five lists (Task 8),
`components/chat/MessageBubble.tsx` (Task 9), `app/(tabs)/_layout.tsx` (Task 10), and
`components/ui/ScreenHeader.tsx` + its 12 callers (Task 11).

**Left alone deliberately:** `app/_layout.tsx:225`. The boot spinner renders before fonts, the
query cache, and the vfx level exist, so it stays an `ActivityIndicator`.

---

### Task 1: The wait table and stage hook

**Files:**
- Create: `mingldingl_app/lib/waiting.ts`
- Create: `mingldingl_app/lib/__tests__/waiting.test.ts`
- Modify: `mingldingl_app/lib/i18n/en.ts`
- Modify: `mingldingl_app/lib/i18n/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type WaitKind = 'verifySms' | 'quizPartner' | 'videoConnect' | 'squareRound'`;
  `interface ActiveStage { readonly key: string; readonly index: number; readonly isFinal: boolean }`;
  `const WAITS: Record<WaitKind, readonly WaitStage[]>`;
  `function stageAt(kind: WaitKind, elapsedMs: number): ActiveStage`;
  `function useWaitStage(kind: WaitKind): ActiveStage`;
  `const STAGE_TWO_MS = 8000`, `const STAGE_THREE_MS = 25000`.

- [ ] **Step 1: Write the failing test**

Create `mingldingl_app/lib/__tests__/waiting.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd mingldingl_app && npm test -- lib/__tests__/waiting.test.ts
```

Expected: FAIL — `Cannot find module '../waiting'`.

- [ ] **Step 3: Add the eight English strings**

In `mingldingl_app/lib/i18n/en.ts`, add near the other `waiting_*` keys:

```ts
  // Stage two and three of the narrated long waits. Stage one always reuses the line that wait
  // already showed (see lib/waiting.ts), so only these needed writing.
  wait_verify_still: 'Still listening at the gate.',
  wait_verify_long: 'This can take a minute. Your message is on its way.',
  wait_quiz_still: 'They have not answered yet.',
  wait_quiz_long: 'They may be away — your answers are saved either way.',
  wait_video_still: 'Opening the way.',
  wait_video_long: 'Still opening. Check your connection if this holds.',
  wait_square_still: 'Finding your seat at the square.',
  wait_square_long: 'The square is slow to answer. Hold a moment longer.',
```

In `mingldingl_app/lib/i18n/index.ts`, append to `AWAITING_MN_TRANSLATION`:

```ts
  // The narrated long waits' second and third lines. Their FIRST lines are already translated
  // (verify_sms_waiting, waiting_match, waiting_join, round_connecting), so a Mongolian speaker
  // sees Mongolian at the moment a wait starts and English only if it runs long. Translate and
  // delete these eight.
  'wait_verify_still', 'wait_verify_long',
  'wait_quiz_still', 'wait_quiz_long',
  'wait_video_still', 'wait_video_long',
  'wait_square_still', 'wait_square_long',
```

- [ ] **Step 4: Write `lib/waiting.ts`**

```ts
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
```

- [ ] **Step 5: Run the tests and confirm they pass**

```bash
cd mingldingl_app && npm test -- lib/__tests__/waiting.test.ts lib/__tests__/i18n.test.ts
```

Expected: PASS, including the i18n parity suite (the eight new keys are on the awaiting list, so
parity holds and the "genuinely missing from mn" check passes).

- [ ] **Step 6: Typecheck**

```bash
cd mingldingl_app && npm run typecheck
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add mingldingl_app/lib/waiting.ts mingldingl_app/lib/__tests__/waiting.test.ts \
        mingldingl_app/lib/i18n/en.ts mingldingl_app/lib/i18n/index.ts
git commit -m "Add the wait table: what each long wait says, and when"
```

---

### Task 2: The inline waiter

**Files:**
- Create: `mingldingl_app/components/ui/Waiting.tsx`
- Create: `mingldingl_app/components/ui/__tests__/Waiting.test.tsx`

**Interfaces:**
- Consumes: `useVfxLevel`, `motionAllowed` from `lib/vfx`; `ORNAMENTS` from `lib/ornaments`.
- Produces: `function Waiting({ size?: number; color?: string }): JSX.Element`. Default `size` is
  `ICON_SIZES.lg` (20), default `color` is `COLORS.gold`. Renders `testID="waiting-knot"`.

- [ ] **Step 1: Write the failing test**

Create `mingldingl_app/components/ui/__tests__/Waiting.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { Waiting } from '../Waiting';
import { COLORS, ICON_SIZES } from '../../../lib/theme';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

describe('Waiting', () => {
  beforeEach(() => {
    mockLevel = 'plain';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('draws the knot at the requested size and tint', () => {
    const { getByTestId } = render(<Waiting size={ICON_SIZES.xl} color={COLORS.text} />);
    expect(getByTestId('waiting-knot').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: ICON_SIZES.xl, height: ICON_SIZES.xl, tintColor: COLORS.text }),
      ]),
    );
  });

  // A spinner is the one thing on screen saying "not frozen", so it must announce itself as
  // busy. It carries no text label on purpose — an untranslated English word is worse here than
  // the platform's own locale-aware "progress bar", which is what role+busy gets us.
  it('announces itself as busy', () => {
    const { getByTestId } = render(<Waiting />);
    const knot = getByTestId('waiting-knot');
    expect(knot.props.accessibilityRole).toBe('progressbar');
    expect(knot.props['aria-busy'] ?? knot.props.accessibilityState?.busy).toBe(true);
  });

  it('starts no animation loop when motion is not allowed', () => {
    mockLevel = 'still';
    render(<Waiting />);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('renders at rest under still rather than vanishing', () => {
    mockLevel = 'still';
    const { getByTestId } = render(<Waiting />);
    expect(getByTestId('waiting-knot')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd mingldingl_app && npm test -- components/ui/__tests__/Waiting.test.tsx
```

Expected: FAIL — `Cannot find module '../Waiting'`.

- [ ] **Step 3: Write `components/ui/Waiting.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { ORNAMENTS } from '../../lib/ornaments';
import { COLORS, ICON_SIZES } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

interface Props {
  size?: number;
  /** Tints the knot, so a button can pass its own label metal. */
  color?: string;
}

const SPIN_MS = 1400;
/** A knot held still is an ornament, not a waiter, so `still` dims it to read as inert. */
const STILL_OPACITY = 0.5;

/**
 * The short wait: the ulzii knot turning.
 *
 * Replaces `ActivityIndicator` wherever a wait is a moment rather than an event — a button
 * submitting, a photo uploading. The knot is `ORNAMENTS.knotGold` tinted through `Image`, not a
 * drawn path, because there is no `react-native-svg` here and Skia cannot mount on web.
 *
 * It carries no text label deliberately: the only string available would be English (the house
 * rule forbids guessed Mongolian), and an English word read aloud to a Mongolian speaker is
 * worse than the platform's own localised "progress bar" from `accessibilityRole`.
 */
export function Waiting({ size = ICON_SIZES.lg, color = COLORS.gold }: Props) {
  const level = useVfxLevel();
  const animate = motionAllowed(level);
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      spin.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Animated.Image
      testID="waiting-knot"
      source={ORNAMENTS.knotGold}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      aria-busy
      style={[
        { width: size, height: size, tintColor: color },
        animate ? { transform: [{ rotate }] } : styles.still,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  still: { opacity: STILL_OPACITY },
});
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd mingldingl_app && npm test -- components/ui/__tests__/Waiting.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
cd mingldingl_app && npm run typecheck
git add mingldingl_app/components/ui/Waiting.tsx mingldingl_app/components/ui/__tests__/Waiting.test.tsx
git commit -m "Add the inline waiter: the knot turning instead of a platform spinner"
```

---

### Task 3: Skeletons

**Files:**
- Create: `mingldingl_app/components/ui/Skeleton.tsx`
- Create: `mingldingl_app/components/ui/__tests__/Skeleton.test.tsx`

**Interfaces:**
- Consumes: `useVfxLevel`, `motionAllowed`.
- Produces:
  `function Skeleton({ width, height, radius?, style? }): JSX.Element` — `width` is
  `number | \`${number}%\``, `height` is `number`, `radius` defaults to `RADIUS.sm`. Renders
  `testID="skeleton-block"`.
  `function SkeletonRows({ count, gap?, row }): JSX.Element` — `row: () => ReactNode`, `gap`
  defaults to `SPACE.md`. Renders `testID="skeleton-rows"`.

- [ ] **Step 1: Write the failing test**

Create `mingldingl_app/components/ui/__tests__/Skeleton.test.tsx`:

```tsx
import { render } from '@testing-library/react-native';
import { Skeleton, SkeletonRows } from '../Skeleton';
import { RADIUS } from '../../../lib/theme';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

describe('Skeleton', () => {
  beforeEach(() => {
    mockLevel = 'plain';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('takes the exact box it is given, so the real row does not shift the layout', () => {
    const { getByTestId } = render(<Skeleton width={120} height={18} />);
    expect(getByTestId('skeleton-block').props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ width: 120, height: 18, borderRadius: RADIUS.sm }),
      ]),
    );
  });

  it('accepts a percentage width', () => {
    const { getByTestId } = render(<Skeleton width="60%" height={18} />);
    expect(getByTestId('skeleton-block').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ width: '60%' })]),
    );
  });

  it('hides itself from the screen reader — it is a placeholder, not content', () => {
    const { getByTestId } = render(<Skeleton width={120} height={18} />);
    expect(getByTestId('skeleton-block').props.accessibilityElementsHidden).toBe(true);
  });

  it('starts no loop when motion is not allowed', () => {
    mockLevel = 'still';
    render(<Skeleton width={120} height={18} />);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('SkeletonRows', () => {
  beforeEach(() => {
    mockLevel = 'plain';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('repeats the row shape the requested number of times', () => {
    const { getAllByTestId } = render(
      <SkeletonRows count={4} row={() => <Skeleton width="100%" height={64} />} />,
    );
    expect(getAllByTestId('skeleton-block')).toHaveLength(4);
  });

  // Fifteen blocks breathing on fifteen loops is the mistake `Lantern` already avoided for
  // seven flames: one shared loop, or none.
  it('runs one loop no matter how many blocks are on screen', () => {
    render(<SkeletonRows count={6} row={() => (
      <>
        <Skeleton width="40%" height={14} />
        <Skeleton width="80%" height={14} />
      </>
    )} />);
    expect(jest.getTimerCount()).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd mingldingl_app && npm test -- components/ui/__tests__/Skeleton.test.tsx
```

Expected: FAIL — `Cannot find module '../Skeleton'`.

- [ ] **Step 3: Write `components/ui/Skeleton.tsx`**

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACE, tint } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

const LOW = 0.35;
const HIGH = 0.6;
const HELD = (LOW + HIGH) / 2;
const BREATH_MS = 900;

/**
 * One breath for every placeholder on screen.
 *
 * A list skeleton is a dozen blocks, and a dozen `Animated.Value`s each running their own loop
 * is a dozen loops drawing the same opacity — the same waste `Lantern` avoids by giving seven
 * flames one flicker. The value is module-level and reference-counted: the first block to mount
 * starts the breath, the last to unmount stops it.
 */
const breath = new Animated.Value(HELD);
let mounted = 0;
let loop: Animated.CompositeAnimation | null = null;

function acquireBreath(animate: boolean): () => void {
  mounted += 1;
  if (animate && !loop) {
    loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: LOW, duration: BREATH_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: HIGH, duration: BREATH_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
  }
  if (!animate && !loop) breath.setValue(HELD);
  return () => {
    mounted -= 1;
    if (mounted > 0) return;
    loop?.stop();
    loop = null;
    breath.setValue(HELD);
  };
}

function useBreath(): Animated.Value {
  const level = useVfxLevel();
  const animate = motionAllowed(level);
  // Re-run only when the level flips, so a re-render never restarts the shared loop.
  const [value] = useState(breath);
  useEffect(() => acquireBreath(animate), [animate]);
  return value;
}

interface Props {
  width: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * A placeholder in the exact shape of the content that will replace it.
 *
 * The shape is the whole point. Every list in this app used to render a centred spinner and then
 * pop to content, which trades a wait for a layout jump; a block that already occupies the real
 * row's box does not move anything when the data lands.
 */
export function Skeleton({ width, height, radius = RADIUS.sm, style }: Props) {
  const value = useBreath();
  return (
    <Animated.View
      testID="skeleton-block"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius }, styles.block, { opacity: value }, style]}
    />
  );
}

interface RowsProps {
  count: number;
  gap?: number;
  /** Called once per row. A function, not an element, so each row is a fresh tree. */
  row: () => ReactNode;
}

/** The same row shape repeated — a list of placeholders rather than one. */
export function SkeletonRows({ count, gap = SPACE.md, row }: RowsProps) {
  return (
    <View testID="skeleton-rows" style={{ gap }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i}>{row()}</View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { backgroundColor: tint(COLORS.text, 0.13) },
});
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd mingldingl_app && npm test -- components/ui/__tests__/Skeleton.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

```bash
cd mingldingl_app && npm run typecheck
git add mingldingl_app/components/ui/Skeleton.tsx mingldingl_app/components/ui/__tests__/Skeleton.test.tsx
git commit -m "Add skeletons shaped like the content they stand in for"
```

---

### Task 4: The narrated long wait

**Files:**
- Create: `mingldingl_app/components/ui/LongWait.tsx`
- Create: `mingldingl_app/components/ui/__tests__/LongWait.test.tsx`

**Interfaces:**
- Consumes: `useWaitStage`, `type WaitKind`, `STAGE_TWO_MS`, `STAGE_THREE_MS` from `lib/waiting`;
  `TorchGlow` from `components/vfx/TorchGlow`; `Icon`.
- Produces: `function LongWait({ kind, action? }): JSX.Element` where `kind: WaitKind` and
  `action?: ReactNode` renders **only on the final stage**. Renders `testID="longwait-line"` and
  `testID="longwait-lamp"`.

- [ ] **Step 1: Write the failing test**

Create `mingldingl_app/components/ui/__tests__/LongWait.test.tsx`:

```tsx
import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { LongWait } from '../LongWait';
import { STAGE_TWO_MS, STAGE_THREE_MS } from '../../../lib/waiting';
import { i18n } from '../../../lib/i18n';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

describe('LongWait', () => {
  beforeEach(() => {
    mockLevel = 'plain';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('opens with the line that wait already showed', () => {
    const { getByTestId } = render(<LongWait kind="verifySms" />);
    expect(getByTestId('longwait-line').props.children).toBe(i18n.t('verify_sms_waiting'));
  });

  it('advances its line as the wait drags on', () => {
    const { getByTestId } = render(<LongWait kind="verifySms" />);
    act(() => { jest.advanceTimersByTime(STAGE_TWO_MS); });
    expect(getByTestId('longwait-line').props.children).toBe(i18n.t('wait_verify_still'));

    act(() => { jest.advanceTimersByTime(STAGE_THREE_MS - STAGE_TWO_MS); });
    expect(getByTestId('longwait-line').props.children).toBe(i18n.t('wait_verify_long'));
  });

  // The rule most likely to be broken by a later change: reduce-motion silences the scene, never
  // the narration. Without the copy advancing, a still 60-second wait is indistinguishable from
  // a frozen screen.
  it('still advances its narration under reduce-motion', () => {
    mockLevel = 'still';
    const { getByTestId } = render(<LongWait kind="verifySms" />);
    act(() => { jest.advanceTimersByTime(STAGE_THREE_MS); });
    expect(getByTestId('longwait-line').props.children).toBe(i18n.t('wait_verify_long'));
  });

  it('holds the action back until the last stage', () => {
    const { queryByText, getByText } = render(
      <LongWait kind="verifySms" action={<Text>Send it again</Text>} />,
    );
    expect(queryByText('Send it again')).toBeNull();

    act(() => { jest.advanceTimersByTime(STAGE_THREE_MS); });
    expect(getByText('Send it again')).toBeTruthy();
  });

  it('renders the lamp at every level, so the wait is never a bare line of text', () => {
    mockLevel = 'still';
    const { getByTestId } = render(<LongWait kind="squareRound" />);
    expect(getByTestId('longwait-lamp')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

```bash
cd mingldingl_app && npm test -- components/ui/__tests__/LongWait.test.tsx
```

Expected: FAIL — `Cannot find module '../LongWait'`.

- [ ] **Step 3: Write `components/ui/LongWait.tsx`**

```tsx
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Icon } from './Icon';
import { TorchGlow } from '../vfx/TorchGlow';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, LINE_HEIGHTS, SPACE } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { useWaitStage, type WaitKind } from '../../lib/waiting';

const SWING_MS = 2200;
const SWING_DEG = 7;
const CHAIN_HEIGHT = SPACE.lg;
const LAMP_SIZE = ICON_SIZES.huge;

/**
 * A lamp hung from a chain, swinging.
 *
 * `Lantern` is not reused here: that one is the streak's seven flames and means something
 * specific. This is the same visual language at a smaller size and says only "someone is still
 * holding a light for you". MaterialCommunityIcons has no `lantern` glyph, so `lamp` stands in.
 *
 * The pivot is the top of the chain rather than the lamp itself — a lamp that rotates about its
 * own centre wobbles, where one swinging from its chain reads as hanging.
 */
function WaitLantern() {
  const level = useVfxLevel();
  const animate = motionAllowed(level);
  const swing = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      swing.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(swing, { toValue: 1, duration: SWING_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(swing, { toValue: -1, duration: SWING_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, swing]);

  const rotate = swing.interpolate({
    inputRange: [-1, 1],
    outputRange: [`-${SWING_DEG}deg`, `${SWING_DEG}deg`],
  });

  return (
    <Animated.View style={[styles.hang, { transform: [{ rotate }] }]}>
      <View style={styles.chain} />
      <TorchGlow size={LAMP_SIZE} color={COLORS.gold}>
        {/* `Icon` takes only name/size/color/style — it does not forward `testID`, and widening
            that shared primitive's API for one test hook is the larger change. */}
        <View testID="longwait-lamp">
          <Icon name="lamp" size={LAMP_SIZE} color={COLORS.gold} />
        </View>
      </TorchGlow>
    </Animated.View>
  );
}

interface Props {
  kind: WaitKind;
  /**
   * A way out, shown only once the wait reaches its final stage — by then the line has already
   * admitted the wait is long, and offering an escape any earlier invites someone to restart a
   * verification that was about to succeed (and pay another 150₮ for it).
   */
  action?: ReactNode;
}

/**
 * The shape every long wait in the app now takes.
 *
 * Before this, the four longest waits each looked different — `video` showed a spinner and no
 * copy whatsoever, `townsquare-round` a spinner above a line, `quiz` an icon and a card, `otp` a
 * spinner beside a line. Same wait, four layouts, and none of them said anything new as the
 * seconds passed.
 */
export function LongWait({ kind, action }: Props) {
  const stage = useWaitStage(kind);
  const line = i18n.t(stage.key);

  return (
    <View style={styles.wrap} accessible accessibilityRole="progressbar" accessibilityLabel={line}>
      <WaitLantern />
      <Text testID="longwait-line" style={styles.line}>{line}</Text>
      {stage.isFinal && action}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: SPACE.lg, paddingVertical: SPACE.xl },
  // The pivot sits at the top of the chain, so the whole assembly swings from where it is hung.
  hang: { alignItems: 'center', transformOrigin: 'top center' },
  chain: { width: 1, height: CHAIN_HEIGHT, backgroundColor: COLORS.brassDark },
  line: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.lg,
    lineHeight: LINE_HEIGHTS.lg,
    color: COLORS.textDim,
    textAlign: 'center',
    paddingHorizontal: SPACE.xl,
  },
});
```

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd mingldingl_app && npm test -- components/ui/__tests__/LongWait.test.tsx
```

Expected: PASS. If `transformOrigin` is unsupported in this RN version the swing still runs about
the centre — replace it with a `translateY(-CHAIN_HEIGHT)` / `rotate` / `translateY(CHAIN_HEIGHT)`
transform triple in that case and keep the test green.

- [ ] **Step 5: Typecheck and commit**

```bash
cd mingldingl_app && npm run typecheck
git add mingldingl_app/components/ui/LongWait.tsx mingldingl_app/components/ui/__tests__/LongWait.test.tsx
git commit -m "Add the narrated long wait: a hung lamp and a line that advances"
```

---

### Task 5: Wave 1 — the four long waits

Fixes spec Part A3 wave 1 **and** style finding 3 (four waits, four layouts) **and** the
loading-branch half of style finding 2 (an opaque ground hiding the world floor during a wait).

**Files:**
- Modify: `mingldingl_app/app/(auth)/otp.tsx:142-148`
- Modify: `mingldingl_app/app/quiz/[matchId].tsx:91`
- Modify: `mingldingl_app/app/video/[matchId].tsx:91-95`
- Modify: `mingldingl_app/app/townsquare-round/[sessionId].tsx:99-106`

**Interfaces:**
- Consumes: `LongWait` from Task 4, `GameButton`.
- Produces: nothing new.

- [ ] **Step 1: `otp.tsx` — replace the waiting row**

Replace the `styles.waitingRow` block (currently an `ActivityIndicator` beside a `Text`):

```tsx
          <LongWait
            kind="verifySms"
            action={
              <GameButton variant="ghost" size="compact" onPress={restart}>
                {i18n.t('verify_start_over')}
              </GameButton>
            }
          />
```

Add `import { LongWait } from '../../components/ui/LongWait';`. Drop `ActivityIndicator` from the
`react-native` import if now unused, and delete the `waitingRow`/`waiting` styles if orphaned.

Note the `loading` branch this replaces showed `verify_sms_sent` while a restart was in flight —
keep that: render `<LongWait kind="verifySms" .../>` only when `!loading`, and keep the existing
`verify_sms_sent` line for the `loading` case.

- [ ] **Step 2: `quiz/[matchId].tsx` — replace the partner spinner**

Replace `{isWaitingForPartner && <ActivityIndicator color={COLORS.gold} />}` with:

```tsx
        {isWaitingForPartner && <LongWait kind="quizPartner" />}
```

The card above already prints `waiting_match`, which `LongWait` now owns as stage 1 — delete the
`isWaitingForPartner` branch of `styles.completionTitle`'s ternary so the line is not shown twice:

```tsx
          <Text style={styles.completionTitle}>
            {isWaitingForPartner ? i18n.t('quiz_answers_in') : i18n.t('compat_revealed')}
          </Text>
```

Add `quiz_answers_in: 'Your answers are in.'` to `en.ts` and to `AWAITING_MN_TRANSLATION` — a
ninth new key, and the only one Task 12 adds beyond the eight.

- [ ] **Step 3: `video/[matchId].tsx` — give the silent wait a voice**

```tsx
  if (loading) return (
    <View style={styles.centered}>
      <LongWait kind="videoConnect" />
    </View>
  );
```

Then make the wait's ground transparent so the world floor shows during it, while leaving the
call itself opaque:

```tsx
  screen: { flex: 1, backgroundColor: COLORS.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
```

- [ ] **Step 4: `townsquare-round/[sessionId].tsx` — same treatment**

```tsx
  if (isLoading || !round) {
    return (
      <View style={[styles.screen, styles.center, styles.waitGround]}>
        <LongWait kind="squareRound" />
      </View>
    );
  }
```

with `waitGround: { backgroundColor: 'transparent' }` added after `screen` so it wins the
cascade. Delete the now-duplicated `{i18n.t('round_connecting')}` `Text` — `LongWait` shows it as
stage 1.

- [ ] **Step 5: Run the affected suites**

```bash
cd mingldingl_app && npm test -- app/townsquare-round app/chat lib/__tests__/i18n.test.ts
```

Expected: PASS. The Town Square suite asserts on screen content, so if it matched the old
`round_connecting` `Text` node directly, update that assertion to query `longwait-line`.

- [ ] **Step 6: Full check**

```bash
cd mingldingl_app && npm run typecheck && npm test
```

Expected: PASS.

- [ ] **Step 7: Verify on device**

Start the engine (`./mingldingl_engine/scripts/start-engine.sh`), run the app on the Galaxy A51,
and reach each of the four waits. Confirm the lamp swings, the line changes at ~8 s and ~25 s, and
the verification wait offers a way out only at the third line. Enable the OS reduce-motion setting
and confirm the lamp holds still while the lines still advance.

- [ ] **Step 8: Commit**

```bash
git add mingldingl_app/app mingldingl_app/lib/i18n
git commit -m "Give the four long waits one shape and a line that advances"
```

---

### Task 6: Wave 2 — skeletons

**Files:**
- Modify: `mingldingl_app/app/(tabs)/matches.tsx:33`, `app/(tabs)/activity.tsx:81`,
  `app/leaderboard.tsx:25`, `app/date-log.tsx:63`, `app/(tabs)/discover.tsx:53`,
  `app/progression.tsx:29`, `app/business/[id].tsx:56,104`, `app/campaign/[matchId].tsx:142`,
  `app/blocked-users.tsx:23`, `components/progression/ScoreHistoryList.tsx:126`

**Interfaces:**
- Consumes: `Skeleton`, `SkeletonRows` from Task 3.
- Produces: nothing new.

- [ ] **Step 1: Replace the list spinners, one screen at a time**

For each *list* screen, swap the centred spinner for rows shaped like that screen's real row. The
pattern, using `matches.tsx` as the worked example — read the real row's own styles first and
match its height and paddings:

```tsx
  if (isLoading) {
    return (
      <View style={styles.listPad}>
        <SkeletonRows count={5} row={() => (
          <View style={styles.rowShape}>
            <Skeleton width={48} height={48} radius={RADIUS.pill} />
            <View style={styles.rowLines}>
              <Skeleton width="55%" height={FONT_SIZES.lg} />
              <Skeleton width="80%" height={FONT_SIZES.md} />
            </View>
          </View>
        )} />
      </View>
    );
  }
```

```tsx
  rowShape: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  rowLines: { flex: 1, gap: SPACE.sm },
```

- [ ] **Step 2: Work through the remaining nine, one shape each**

Each entry below gives the shape to build. Open the screen's real row or hero first and copy its
height, gap and padding — the placeholder must land in the same box, which is the entire point.

| Screen | Shape |
|---|---|
| `app/(tabs)/activity.tsx:81` | `count={4}`; per row a `Skeleton width="100%" height={72}` card block. The `:135` footer spinner is pagination — leave it for Task 7. |
| `app/leaderboard.tsx:25` | `count={8}`; per row `width={24} height={FONT_SIZES.md}` (rank), `width={32} height={32} radius={RADIUS.pill}` (avatar), `width="45%" height={FONT_SIZES.md}` (name), all in one `flexDirection: 'row'` with `gap: SPACE.md`. |
| `app/date-log.tsx:63` | `count={4}`; per row `width="35%" height={FONT_SIZES.sm}` (date) above `width="70%" height={FONT_SIZES.lg}` (venue), `gap: SPACE.sm`. |
| `app/blocked-users.tsx:23` | `count={3}`; per row `width={32} height={32} radius={RADIUS.pill}` beside `width="50%" height={FONT_SIZES.md}`. |
| `components/progression/ScoreHistoryList.tsx:126` | Pagination footer, not a first load — a single `<Skeleton width="100%" height={56} />` replacing the `isFetchingNextPage` indicator. |
| `app/(tabs)/discover.tsx:53` | One card-shaped block matching `CandidateCard`'s box: `width="100%"` and the card's own height, `radius={RADIUS.lg}`. |
| `app/progression.tsx:29` | Three stacked blocks: `width="100%" height={14} radius={RADIUS.sm}` (the XP track), then `width="60%" height={FONT_SIZES.title}`, then `width="100%" height={120}`. |
| `app/business/[id].tsx:56` and `:104` | Hero then body: `width="100%" height={180} radius={RADIUS.md}`, then `width="70%" height={FONT_SIZES.title}`, then two `width="100%" height={FONT_SIZES.md}` lines. Both sites get the same shape. |
| `app/campaign/[matchId].tsx:142` | The map is a single large block: `width="100%" height={240} radius={RADIUS.md}`. |

- [ ] **Step 3: Confirm no screen still centres a spinner for a list**

```bash
cd mingldingl_app && grep -rn "ActivityIndicator" app/ components/ | grep -v __tests__
```

Expected: only the inline sites Task 7 will handle, plus `app/_layout.tsx:225` (the boot spinner,
left alone on purpose).

- [ ] **Step 4: Full check**

```bash
cd mingldingl_app && npm run typecheck && npm test
```

Expected: PASS. Any test asserting on a spinner's presence during load needs updating to query
`skeleton-rows` or `skeleton-block`.

- [ ] **Step 5: Verify on device**

Open each screen cold (kill and relaunch so the query cache is empty) and confirm the placeholder
occupies the same box the real row lands in — nothing should jump when data arrives.

- [ ] **Step 6: Commit**

```bash
git add mingldingl_app/app mingldingl_app/components
git commit -m "Shape the loading lists like the lists they become"
```

---

### Task 7: Wave 3 — the inline sites

The droppable wave. If the turning knot reads cheaper on device than the spinner it replaced, stop
after Step 1 and revert; waves 1 and 2 carry the value.

**Files:**
- Modify: `mingldingl_app/components/ui/GameButton.tsx:76`, `app/(tabs)/activity.tsx:135`
  (the pagination footer Task 6 deferred here), `components/PhotoGrid.tsx:104,138`,
  `components/profile/ProfileAvatar.tsx:86`, `app/edit-profile.tsx:219`,
  `components/onboarding/AboutStep.tsx:72`, `components/settings/PhoneChangeModal.tsx:111`,
  `app/(auth)/otp.tsx:143`, `components/ContentPageScreen.tsx:29`,
  `app/activities/[matchId].tsx:79,121`, `app/icebreaker/[matchId].tsx:42,74`,
  `app/membership.tsx:74`, `app/chat/[matchId].tsx:250,283`

**Interfaces:**
- Consumes: `Waiting` from Task 2.
- Produces: nothing new.

- [ ] **Step 1: `GameButton` first, then judge**

```tsx
        {loading ? (
          <Waiting color={BUTTON_METALS[variant].label} />
        ) : (
```

Build it, put it on the A51, press a submitting button. If the knot looks worse than the spinner,
stop here and revert this task.

- [ ] **Step 2: Replace the remaining inline spinners**

First re-grep, because Task 5 already replaced some of these: `grep -rn "ActivityIndicator" app/ components/ | grep -v __tests__`. Handle only what is actually left — in
particular `app/(auth)/otp.tsx` may have none remaining, in which case skip it. Then:

`<ActivityIndicator color={COLORS.gold} />` → `<Waiting />`;
`<ActivityIndicator color={COLORS.gold} size="small" />` → `<Waiting size={ICON_SIZES.md} />`;
`<ActivityIndicator color={tierColor} />` (in `ProfileAvatar`) → `<Waiting color={tierColor} />`.

Remove the now-unused `ActivityIndicator` import from each file.

- [ ] **Step 3: Confirm only the boot spinner remains**

```bash
cd mingldingl_app && grep -rn "ActivityIndicator" app/ components/ | grep -v __tests__
```

Expected: exactly two lines, both `app/_layout.tsx` (its import and line 225).

- [ ] **Step 4: Full check and commit**

```bash
cd mingldingl_app && npm run typecheck && npm test
git add mingldingl_app/app mingldingl_app/components
git commit -m "Turn the knot instead of the platform spinner"
```

---

### Task 8: List entrance stagger

**Files:**
- Create: `mingldingl_app/components/ui/Entering.tsx`
- Create: `mingldingl_app/components/ui/__tests__/Entering.test.tsx`
- Modify: the `renderItem` of `app/(tabs)/matches.tsx`, `app/(tabs)/activity.tsx`,
  `app/leaderboard.tsx`, `app/date-log.tsx`, `components/progression/ScoreHistoryList.tsx`

**Interfaces:**
- Consumes: `useVfxLevel`, `motionAllowed`.
- Produces: `function Entering({ index, children }): JSX.Element` — `index: number`,
  `children: ReactNode`. Renders `testID="entering"`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Entering, ENTER_CAP } from '../Entering';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

describe('Entering', () => {
  beforeEach(() => {
    mockLevel = 'plain';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('renders its child', () => {
    const { getByText } = render(<Entering index={0}><Text>a row</Text></Entering>);
    expect(getByText('a row')).toBeTruthy();
  });

  it('starts no animation under reduce-motion, leaving the row at rest', () => {
    mockLevel = 'still';
    const { getByTestId } = render(<Entering index={3}><Text>a row</Text></Entering>);
    expect(jest.getTimerCount()).toBe(0);
    // `style` is an object here, not an array, and `opacity` is an Animated.Value — read it with
    // `__getValue()` rather than comparing it to a number.
    expect(getByTestId('entering').props.style.opacity.__getValue()).toBe(1);
  });

  // A hundred-row list must not animate a tail nobody has scrolled to, and a row past the cap
  // must not be invisible while it waits its turn.
  it('does not delay rows past the cap', () => {
    const { getByTestId } = render(<Entering index={ENTER_CAP + 5}><Text>a row</Text></Entering>);
    expect(getByTestId('entering').props.style.opacity.__getValue()).toBe(1);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd mingldingl_app && npm test -- components/ui/__tests__/Entering.test.tsx
```

Expected: FAIL — `Cannot find module '../Entering'`.

- [ ] **Step 3: Write `components/ui/Entering.tsx`**

```tsx
import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

export const STAGGER_MS = 40;
/** Rows past this arrive at rest — a long list must not animate a tail nobody is looking at. */
export const ENTER_CAP = 8;
const RISE_PX = 8;
const FADE_MS = 260;

interface Props {
  index: number;
  children: ReactNode;
}

/**
 * A list row arriving: a short fade and an 8px rise, staggered by position, as if the rows were
 * lit one at a time.
 *
 * First mount only. Re-running on every refetch would make pull-to-refresh flicker the whole
 * list, which is why the animation lives in a `useRef` guard rather than keying off the data.
 */
export function Entering({ index, children }: Props) {
  const level = useVfxLevel();
  const animate = motionAllowed(level) && index < ENTER_CAP;
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const started = useRef(false);

  useEffect(() => {
    if (!animate || started.current) return;
    started.current = true;
    Animated.timing(progress, {
      toValue: 1,
      duration: FADE_MS,
      delay: index * STAGGER_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [animate, index, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [RISE_PX, 0] });

  return (
    <Animated.View testID="entering" style={{ opacity: progress, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}
```

- [ ] **Step 4: Run it and confirm it passes**

```bash
cd mingldingl_app && npm test -- components/ui/__tests__/Entering.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Wrap the five lists' rows**

In each `renderItem`, wrap the existing row: `renderItem={({ item, index }) => (<Entering index={index}>{/* the existing row */}</Entering>)}`.

- [ ] **Step 6: Full check, device check, commit**

```bash
cd mingldingl_app && npm run typecheck && npm test
```

On the A51, open a list cold and confirm the rows arrive in sequence; then pull to refresh and
confirm they do **not** re-animate.

```bash
git add mingldingl_app/components mingldingl_app/app
git commit -m "Light the list rows one at a time as they arrive"
```

---

### Task 9: The un-inked bubble

**Files:**
- Modify: `mingldingl_app/components/chat/MessageBubble.tsx`
- Create: `mingldingl_app/components/chat/__tests__/MessageBubble.test.tsx`

**Interfaces:**
- Consumes: `Message` from `hooks/useChat` — already carries
  `status?: 'sending' | 'failed' | undefined`. Read the exact `Message` shape from
  `hooks/useChat.ts` before writing the fixture; add only the fields it actually requires.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Create `mingldingl_app/components/chat/__tests__/MessageBubble.test.tsx` — beside the component,
where the other `components/chat/` tests live:

```tsx
import { render } from '@testing-library/react-native';
import { MessageBubble } from '../../../components/chat/MessageBubble';

import type { Message } from '../../../hooks/useChat';

const base: Message = {
  id: 'm1',
  senderId: 'me',
  content: 'hello',
  sentAt: new Date().toISOString(),
};

describe('MessageBubble in flight', () => {
  it('shows a sending message as not yet inked', () => {
    const { getByTestId } = render(
      <MessageBubble message={{ ...base, status: 'sending' }} myId="me" />,
    );
    expect(getByTestId('bubble').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ opacity: expect.any(Number) })]),
    );
  });

  it('inks a delivered message fully', () => {
    const { getByTestId } = render(<MessageBubble message={base} myId="me" />);
    const flat = getByTestId('bubble').props.style.filter(Boolean);
    expect(flat).not.toContainEqual(expect.objectContaining({ opacity: 0.6 }));
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd mingldingl_app && npm test -- components/chat/__tests__/MessageBubble.test.tsx
```

Expected: FAIL — no `testID="bubble"` yet.

- [ ] **Step 3: Give `sending` its own state**

In `MessageBubble.tsx`, add alongside `isFailed`:

```tsx
  const isSending = message.status === 'sending';
```

add `testID="bubble"` and the style to the bubble `View`:

```tsx
    <View testID="bubble" style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs, isSending && styles.bubbleSending, isFailed && styles.bubbleFailed]}>
```

and the style itself:

```tsx
  // A message in flight used to render exactly like a delivered one, so there was no way to tell
  // a sent message from one still going. Not yet inked: pale, and without the squared corner
  // that marks a message as landed.
  bubbleSending: { opacity: 0.6, borderBottomRightRadius: RADIUS.lg },
```

- [ ] **Step 4: Run it, typecheck, commit**

```bash
cd mingldingl_app && npm test -- components/chat && npm run typecheck
git add mingldingl_app/components/chat
git commit -m "Show a message in flight as not yet inked"
```

---

### Task 10: Tab-icon ignite

**Files:**
- Modify: `mingldingl_app/app/(tabs)/_layout.tsx:15-18`

**Interfaces:**
- Consumes: `motionAllowed`, `useVfxLevel`.
- Produces: nothing new.

- [ ] **Step 1: Make the glyph a component that reacts to focus**

React Navigation passes `focused` to `tabBarIcon` alongside `color`. Replace the `tabIcon` helper:

```tsx
const TabGlyphIcon = ({ glyph, color, focused }: { glyph: TabGlyph; color: string; focused: boolean }) => {
  const animate = motionAllowed(useVfxLevel());
  const lit = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (!animate) {
      lit.setValue(focused ? 1 : 0);
      return;
    }
    Animated.timing(lit, {
      toValue: focused ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [focused, animate, lit]);

  const scale = lit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Icon name={glyph} size={ICON_SIZES.xl} color={color} style={styles.glyph} />
    </Animated.View>
  );
};

const tabIcon = (glyph: TabGlyph) => ({ color, focused }: { color: string; focused: boolean }) => (
  <TabGlyphIcon glyph={glyph} color={color} focused={focused} />
);
```

Add the `useEffect`/`useRef` and `Animated`/`Easing` imports. The colour change from
`tabBarActiveTintColor` already supplies the brightening; this adds only the scale, so the two
read as one ignite.

- [ ] **Step 2: Full check, device check, commit**

```bash
cd mingldingl_app && npm run typecheck && npm test
```

On the A51, switch tabs and confirm the glyph pops slightly without the label shifting (the label
lives in React Navigation's own slot, so it should not move — if it does, the scale is being
applied to the label slot and must be moved inside the icon).

```bash
git add "mingldingl_app/app/(tabs)/_layout.tsx"
git commit -m "Ignite the tab you switch into"
```

---

### Task 11: Collapse the redundant header wrapper

Style finding 1. `ScreenHeader` forwards `title`/`onBack`/`right` to `HeaderBar` and adds nothing
— but because it does not forward `showBack`, it silently always shows a back button while
`GameHeader` silently never does. Two wrappers with opposite defaults over one base.

**Files:**
- Delete: `mingldingl_app/components/ui/ScreenHeader.tsx`
- Modify: its 12 callers

**Interfaces:**
- Consumes: `HeaderBar`, whose props are
  `{ title: string; showBack?: boolean; onBack?: () => void; icon?: GlyphName; right?: ReactNode; children?: ReactNode }`
  and whose `showBack` already defaults to `true` — the same behaviour `ScreenHeader` produced.
- Produces: nothing new.

- [ ] **Step 1: Find every caller**

```bash
cd mingldingl_app && grep -rn "ScreenHeader" --include=*.tsx app/ components/
```

- [ ] **Step 2: Rewrite each call site**

`<ScreenHeader title={x} onBack={y} right={z} />` → `<HeaderBar title={x} onBack={y} right={z} />`,
and change the import to `components/ui/HeaderBar`. `HeaderBar`'s `showBack` default of `true`
matches what `ScreenHeader` gave, so no call site changes behaviour.

- [ ] **Step 3: Delete the wrapper**

```bash
cd mingldingl_app && rm components/ui/ScreenHeader.tsx
```

- [ ] **Step 4: Confirm nothing references it**

```bash
cd mingldingl_app && grep -rn "ScreenHeader" --include=*.tsx --include=*.ts . | grep -v node_modules
```

Expected: no output.

- [ ] **Step 5: Full check and commit**

```bash
cd mingldingl_app && npm run typecheck && npm test
git add -A mingldingl_app/components/ui mingldingl_app/app
git commit -m "Collapse ScreenHeader into HeaderBar: one header, one back-button default"
```

---

### Task 12: Land the Mongolian and empty the debt list

Do this task when the translations arrive, not before. Until then the nine keys sit on
`AWAITING_MN_TRANSLATION` and render in English via `enableFallback`.

**Files:**
- Modify: `mingldingl_app/lib/i18n/mn.ts`
- Modify: `mingldingl_app/lib/i18n/index.ts`

**Interfaces:**
- Consumes: the nine keys added in Tasks 1 and 5 — `wait_verify_still`, `wait_verify_long`,
  `wait_quiz_still`, `wait_quiz_long`, `wait_video_still`, `wait_video_long`,
  `wait_square_still`, `wait_square_long`, `quiz_answers_in`.
- Produces: an `AWAITING_MN_TRANSLATION` no longer than it was before this feature.

- [ ] **Step 1: Add the nine translations to `mn.ts`**

Use the Mongolian supplied by the project owner verbatim. Do not guess or machine-translate — the
house rule in `lib/i18n/index.ts` exists because a subtly wrong word in front of a user is worse
than a visible English gap.

- [ ] **Step 2: Remove the nine keys from `AWAITING_MN_TRANSLATION`**

Delete the two comment blocks and the nine entries added in Tasks 1 and 5.

- [ ] **Step 3: Let the parity test prove both directions**

```bash
cd mingldingl_app && npm test -- lib/__tests__/i18n.test.ts
```

Expected: PASS. The suite checks that every non-awaiting key exists in both locales, that every
awaiting key is genuinely absent from `mn`, and that interpolation variables match — so a
half-finished translation fails here rather than in front of a user.

- [ ] **Step 4: Commit**

```bash
git add mingldingl_app/lib/i18n
git commit -m "Translate the wait narration and empty its line off the debt list"
```

---

## Final verification

- [ ] `cd mingldingl_app && npm run typecheck && npm test`
- [ ] `./scripts/check-all.sh` from the repo root (or `CHECK_SKIP_ENGINE=1 ./scripts/check-all.sh`
      if local Postgres is not up)
- [ ] `grep -rn "ActivityIndicator" mingldingl_app/app mingldingl_app/components | grep -v __tests__`
      returns only `app/_layout.tsx`
- [ ] On the Galaxy A51: each of the four long waits narrates; lists show shaped skeletons and do
      not jump; rows arrive staggered once and not on refresh; a message in flight looks unsent
- [ ] With OS reduce-motion on: nothing loops, and the long waits still advance their copy
- [ ] Move this feature's record from `docs/superpowers/project-plan.md` to
      `docs/superpowers/shipped-log.md`, per the repo's CLAUDE.md
