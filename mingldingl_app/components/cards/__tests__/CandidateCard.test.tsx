import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { CandidateCard } from '../CandidateCard';
import type { Candidate } from '../../../models/user';

/**
 * WCAG contrast math, kept local rather than imported from `lib/__tests__/palette.test.ts` — that
 * file asserts theme roles against flat surfaces; this asserts one component's dot against its own
 * composited scrim, which is a different worst case (see `worstCaseBg` below).
 */
function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}
function luminance([r, g, b]: [number, number, number]): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrastRgb(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

/**
 * The dots sit on `photoDotsScrim`, a `LinearGradient` from `overlay(0.75)` (rgb 10,11,16) to
 * transparent. The worst case for legibility is a bright/white photo underneath, composited at the
 * scrim's declared strength — the same framing `CandidateCard`'s own comment above `photoDot` uses
 * to justify the inactive dots' fix (measured there at ~3.1:1, which this file's second assertion
 * reproduces as a floor so the active dot cannot regress below what the inactive ones already
 * clear).
 */
function worstCaseBg(): [number, number, number] {
  const scrim: [number, number, number] = [10, 11, 16];
  const alpha = 0.75;
  const white: [number, number, number] = [255, 255, 255];
  return [0, 1, 2].map((i) => white[i] * (1 - alpha) + scrim[i] * alpha) as [number, number, number];
}

const CANDIDATE: Candidate = {
  id: 'c1', displayName: 'Riley', age: 27, gender: 'female', city: 'Ulaanbaatar', bio: '',
  photoUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
  membershipLevel: 'Free', isProfileComplete: true, pushEnabled: true,
  ageMin: 18, ageMax: 99, isPaused: false, oath: null, oathProven: false,
  oathEncountersHeld: null, oathEncountersNeeded: null, deletionGraceDays: 14,
  deletionRequestedAt: null, preferredLocale: 'en', gemTier: 'Garnet',
} as Candidate;

function renderCard(props: Partial<ComponentProps<typeof CandidateCard>> = {}) {
  return render(
    <CandidateCard candidate={CANDIDATE} onRequest={jest.fn()} onSkip={jest.fn()} {...props} />,
  );
}

describe('CandidateCard photo dots', () => {
  it('clears the 3:1 floor for the active dot against its worst-case scrim', () => {
    const { getByTestId } = renderCard();
    const style = StyleSheet.flatten(getByTestId('photo-dot-active').props.style);
    const ratio = contrastRgb(hexToRgb(style.backgroundColor), worstCaseBg());
    expect(ratio).toBeGreaterThanOrEqual(3);
  });

  it('never leaves the active (emphasised) dot less legible than an inactive one', () => {
    const { getByTestId, getAllByTestId } = renderCard();
    const bg = worstCaseBg();
    const activeStyle = StyleSheet.flatten(getByTestId('photo-dot-active').props.style);
    const inactiveStyle = StyleSheet.flatten(getAllByTestId('photo-dot-inactive')[0].props.style);
    const activeRatio = contrastRgb(hexToRgb(activeStyle.backgroundColor), bg);
    const inactiveRatio = contrastRgb(hexToRgb(inactiveStyle.backgroundColor), bg);
    expect(activeRatio).toBeGreaterThanOrEqual(inactiveRatio);
  });
});

/**
 * Regression for task-8: beneath `GettingStartedCard` on first run, this card's `flex: 1` can be
 * squeezed to a sliver — the info plaque (name/bio/actions) stays roughly fixed height regardless,
 * so a short card read as mostly plaque and the photo cropped to a forehead. The card floors its
 * own height to a portrait-shaped multiple of its measured width, independent of how tall the
 * plaque itself happens to be (which varies with bio length) — but that floor is itself clamped to
 * `availableHeight` (the screen's measured `cardArea`, which this screen never scrolls) minus room
 * for the action row: the floor must never win against Skip / Send Summons landing outside the
 * card. See task-8-report.md's "clamp" addendum for why this bounds the floor to a no-op in the
 * exact squeeze case it was written for.
 */
describe('CandidateCard minimum photo height', () => {
  it('has no minHeight before its first layout, so it never renders collapsed or empty', () => {
    const { getByTestId } = renderCard();
    const style = StyleSheet.flatten(getByTestId('candidate-card').props.style);
    expect(style.minHeight).toBeUndefined();
    // The card still fills whatever space its parent gives it on that first frame.
    expect(style.flex).toBe(1);
  });

  it('floors the card at a portrait aspect ratio when the screen has room to give it', () => {
    const { getByTestId } = renderCard({ availableHeight: 1000 });
    const card = getByTestId('candidate-card');
    fireEvent(getByTestId('candidate-actions'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 52 } },
    });
    // A width typical of a phone card column, on a tall screen with no getting-started board
    // squeezing it — the ideal 4:3 floor comfortably fits inside `availableHeight`.
    fireEvent(card, 'layout', { nativeEvent: { layout: { width: 353, height: 900 } } });
    const style = StyleSheet.flatten(card.props.style);
    expect(style.minHeight).toBeCloseTo(353 * (4 / 3));
  });

  it('never asks for more than the screen has left after the action row, board visible + maximal content', () => {
    // The exact case the overflow concern named: GettingStartedCard, the daily budget meter, and
    // an active gathering pill have all taken their share above `cardArea`, and this candidate has
    // every optional field (city, equipped title, two-line bio) pushing the plaque tall too.
    const MAXIMAL: Candidate = {
      ...CANDIDATE,
      equippedTitleId: 'title_dawnwarden',
      bio: 'Long enough to wrap a full two lines in the plaque, the way a real bio regularly does.',
    };
    const { getByTestId } = renderCard({ candidate: MAXIMAL, availableHeight: 380 });
    const card = getByTestId('candidate-card');
    const actionsHeight = 52; // GameButton's default `minHeight` — see components/ui/GameButton.tsx
    fireEvent(getByTestId('candidate-actions'), 'layout', {
      nativeEvent: { layout: { width: 320, height: actionsHeight } },
    });
    // The squeezed height a `flex: 1` card actually gets under the board in this scenario — see
    // the report's layout maths. What matters for this test is only the *ceiling* asserted below.
    fireEvent(card, 'layout', { nativeEvent: { layout: { width: 353, height: 160 } } });
    const style = StyleSheet.flatten(card.props.style);
    const idealFloor = 353 * (4 / 3);
    const spaceLeftAfterActions = 380 - 16 /* cardArea's paddingBottom, SPACE.lg */
      - (actionsHeight + 8 /* the action row's own marginTop, SPACE.sm */);
    // The invariant: the computed floor never exceeds what's left after the action row's own
    // guaranteed space, at any content size.
    expect(style.minHeight).toBeLessThanOrEqual(spaceLeftAfterActions);
    // And in this squeeze scenario, that ceiling is well short of the 4:3 ideal — the clamp is
    // actually binding here, not a no-op that happens to never trigger.
    expect(style.minHeight).toBeLessThan(idealFloor);
  });
});
