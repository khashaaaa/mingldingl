# The Waiting Vocabulary

**Date:** 2026-09-10
**Scope:** `mingldingl_app` only. No engine changes.

## Problem

The app's celebration and progress layers are richly built — `XPBar` (animated fill, shimmer, a
red flash when score *drops*), `CountText`, `TierUpCeremony`, `SealedLetter`/`Unsealing`,
`ChestBurst`/`LootToast`, `Lantern`, `HonourCase` ignition, `GateScene`, the world light table,
and a haptic+sound table with a `full`/`plain`/`still`/`off` ladder.

Waiting has none of it. Roughly thirty call sites render the same thing:

```tsx
<ActivityIndicator color={COLORS.gold} />
```

There are no skeletons anywhere in the app, so every list pops from a centred spinner to content
and the layout jumps. In an app that otherwise looks hand-forged, the platform spinner is the one
element that reads as a stock React Native default — and it appears at every moment of doubt.

Worse, all waits currently look identical whether they last 200 ms or 60 s. The longest waits are
the ones with the least support: on the verification screen the user has just texted a code to
shortcode 144773 and watches a spinner for 10–60 s with one fixed line of copy, which is
indistinguishable from a frozen screen.

## What this is not

Two ideas were considered and are deliberately excluded:

- **Shared-element transitions** (candidate card growing into the profile screen). Already
  rejected on record in `lib/world/travel.ts`: *"Shared-element work is the worst
  effort-to-payoff trade on Android, and the light and sound layers already carry the feeling."*
  Not re-litigated here.
- **Pull-to-refresh as a self-drawing knot.** `RefreshControl` is a native component whose glyph
  cannot be replaced; doing it properly means abandoning `RefreshControl` for a gesture-driven
  custom header on three lists. Same effort-to-payoff trade as above. Dropped.

Also already built, and therefore out of scope: **room-to-room travel direction**. `animationFor`
in `lib/world/travel.ts` is wired into the `Stack`'s `screenOptions` — deeper rooms open from
below, lateral movement is a cut, reduce-motion is a fade.

## Constraint: plain RN only

Every piece here uses RN `Animated` plus the pre-generated ornament PNGs. No Skia paths, no
`react-native-svg` (not installed).

This follows the two-tier convention already in the codebase: `components/vfx/` and
`components/world/` use Reanimated + Skia; every UI component (`XPBar`, `GameButton`,
`TierUpCeremony`, `SealedLetter`, `Lantern`) uses RN `Animated`. Waits are functional UI and
belong in the component tier.

It also avoids a trap `lib/vfx.ts` documents having already fallen into once — the whole vfx
layer was blank on web, *"the surface the app is developed and E2E-tested on, so the effects were
effectively invisible to their own author."* A loading state that is invisible on web is worse
than an ember that is.

`TorchGlow` is the one vfx component the scenes may use, because it already resolves all four
levels itself (Skia at `full`, an RN shadow at `plain`, a held midpoint at `still`).

Every effect needs a `still` form, per `lib/vfx.ts`. The rule for this feature:

> **The scene goes still; the narration does not.** Reduce-motion is a request for less movement,
> not less information. Under `still` a skeleton holds a flat opacity and a lantern stops
> swinging, but the staged copy still advances on schedule — it is the only thing telling someone
> the app has not frozen.

## Part A — the wait vocabulary

### A1. `lib/waiting.ts`, the table

The copy and shape of every wait live in one table, exactly as `Services/PushCopy.cs` holds push
copy and `lib/world/feedback.ts` holds haptics and sound. Adding a wait means adding a row, never
a literal at a call site.

```ts
export type WaitKind = 'verifySms' | 'quizPartner' | 'videoConnect' | 'squareRound';

interface Stage {
  /** ms since the wait began. The first stage is always 0. */
  readonly afterMs: number;
  /** i18n key for this stage's line. */
  readonly key: string;
}

interface WaitDef {
  readonly stages: readonly Stage[];
}
```

All four waits share one scene (the hanging lantern below), so the table carries no `scene`
field — the rows differ only in their narration. A second scene means adding the field then, not
now.

**Three of the four first stages reuse the key that site already shows**, so no wait's opening
line changes and no new Mongolian is needed for it. All four already exist in `mn.ts`:

| Kind | Stage 1 (existing key) | Site |
|---|---|---|
| `verifySms` | `verify_sms_waiting` | `app/(auth)/otp.tsx:143` |
| `quizPartner` | `waiting_match` | `app/quiz/[matchId].tsx:91` |
| `videoConnect` | `waiting_join` (adopted; see below) | `app/video/[matchId].tsx:93` |
| `squareRound` | `round_connecting` | `app/townsquare-round/[sessionId].tsx:102` |

`videoConnect` is the exception: its loading branch currently shows a bare spinner with no copy
at all, so stage 1 *adopts* `waiting_join` rather than keeping a line it already had. The key
exists and is already translated, so this still costs no new Mongolian — and it fixes a wait that
today says nothing whatsoever.

Stages 2 and 3 are new keys — eight in total. Thresholds: stage 2 at 8 s, stage 3 at 25 s.

A `useWaitStage(kind)` hook returns the current stage. It drives from **one** `setTimeout` chain,
not an interval per stage and not a per-second tick — nothing here needs to know the elapsed
second, only which of three lines to show. It clears on unmount and resets when `kind` changes.
It ignores the vfx level, per the still-narration rule above.

### A2. Three components

**`components/ui/Waiting.tsx`** — the inline waiter. `ORNAMENTS.knotGold` rendered through
`Image` with `tintColor` (so `GameButton` can pass its own label metal), rotating on one
`Animated.loop`. Under `still`, a static knot at reduced opacity with no loop started. Props:
`size`, `color`. This is the direct `ActivityIndicator` replacement for short waits.

**`components/ui/Skeleton.tsx`** — a `Skeleton` primitive (`width`, `height`, `radius`) that
breathes its opacity between 0.35 and 0.6 on a shared loop, holding flat at 0.45 under `still`,
plus a `SkeletonRows` helper that repeats a shape *n* times. Screens compose two or three of
these inline; this deliberately does **not** add a file per screen.

The point is the *shape*: a skeleton must occupy the same box the real row will, or it trades a
spinner for a different layout jump.

**`components/ui/LongWait.tsx`** — scene plus staged narration. Renders the scene for its
`WaitKind`, the current stage's line, and an optional caller-supplied action (verification's
stage 3 offers "send it again"; the action is screen-specific so it stays a prop, not a table
field). The scene is a hanging lantern on a slow pendulum rotation wrapped in `TorchGlow`, and
under `still` the lantern hangs straight with the glow held.

`Lantern` itself is not reused — it is the streak's seven-flame lantern and means something
specific. The wait scene is a new, much smaller component in the same visual language.

### A3. Migration waves

Ordered by payoff, each independently device-verifiable on the Galaxy A51:

1. **The four long waits** — `LongWait` + the table + narration. The highest-value change in the
   whole spec.
2. **Skeletons** — `matches`, `activity`, `leaderboard`, `date-log`, `ScoreHistoryList`,
   `discover`, `progression`, `business/[id]`, `campaign`, `blocked-users`.
3. **Inline** — `GameButton`, `PhotoGrid`, `ProfileAvatar`, `edit-profile`, `AboutStep`,
   `PhoneChangeModal`, `otp`, `ContentPageScreen`, `activities/[matchId]`, `icebreaker/[matchId]`,
   `membership`, `chat/[matchId]`'s earlier-messages footer.

`app/_layout.tsx:225` — the boot spinner — stays an `ActivityIndicator`. It renders before fonts,
the query cache, and the vfx level are ready, and the splash is the one screen that must not
depend on any of them.

## Part C — list entrance stagger

An `<Entering index>` wrapper component applied in the `renderItem` of the five list screens — a
wrapper rather than a hook because each row needs its own `Animated.Value`, which is the
component's job to own and not the caller's to thread through: each row fades and rises ~8 px, staggered ~40 ms by index, capped at the
first ~8 rows so a long list does not animate a tail nobody is looking at. Under `still`, rows
appear at rest.

Rows animate on **first mount only** — re-running on every refetch would make pull-to-refresh
flicker the whole list.

## Part D — two small pieces

**The un-inked bubble.** `useChat` already carries `status: 'sending' | 'failed'` and
`MessageBubble` already styles `failed` (`opacity: 0.55` plus a retry row) — but a message *in
flight* renders identically to a delivered one. Give `sending` its own state: pale fill, no
bottom-corner seal, inking to full on ack. No new plumbing; the data is already there.

**Tab-icon ignite.** The active tab's glyph gets a short scale-and-brighten on focus, via the
existing `tabIcon` helper in `app/(tabs)/_layout.tsx`. Small, self-contained, and it makes the
five rooms feel switched-into rather than swapped.

## The Mongolian

Eight new strings (stages 2 and 3 of four waits) — **nine** as implemented: planning found that
once `LongWait` owns the quiz screen's `waiting_match` line as its stage 1, the card above it
needs its own heading (`quiz_answers_in`) or the same sentence appears twice. The house rule in `lib/i18n/index.ts` forbids
AI-guessed Mongolian, and `AWAITING_MN_TRANSLATION`'s comment says *"Empty this list; never grow
it."*

Plan: draft the English, park the eight keys on `AWAITING_MN_TRANSLATION` with a comment marking
them pending review, and hand the English to the project owner for translation. `enableFallback`
renders them in English for an `mn` user meanwhile, which is a visible gap rather than a wrong
word. **Emptying those eight keys off the list is the final task of the implementation plan** —
the list is not left grown.

## Testing

Follows the existing pattern in `components/**/__tests__` and `lib/world/__tests__`:

- `lib/__tests__/waiting.test.ts` — stage selection at 0 / 8 s / 25 s boundaries with fake
  timers; every `WaitKind` has stages, and stage 1's key exists in both `en` and `mn`; timers
  clear on unmount.
- The i18n parity test already enforces both directions, so it will catch the eight new keys
  being absent from `mn` unless they are on the awaiting list — and will catch them again when
  the translations land.
- `Skeleton`, `Waiting`, `LongWait` — a `still`-level test each asserting no loop is started, and
  a `plain`-level test asserting one is.
- Narration advances under `still` (the rule most likely to be broken by a later change).
- `npm run typecheck` and `npm test` per wave, plus device verification on the A51.

## Risks

- **Thirty call sites** is a wide diff. Mitigated by the wave order; each wave stands alone.
- **A rotating PNG can look cheap** where a spinner looked neutral. If the inline waiter reads
  worse than what it replaced on device, wave 3 is the droppable one — waves 1 and 2 carry the
  value.
- **`still` regressions are invisible in normal use.** Hence a dedicated test per component.
