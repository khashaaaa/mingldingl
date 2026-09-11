import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { CandidateCard } from '../CandidateCard';
import type { Candidate } from '../../../models/user';

// The card is rendered here without the navigator that mounts `WorldProvider`, so the hold has to
// be stood up by hand. A real `useWorld()` returning null is also correct — that is the unlit
// route — and `components/world/__tests__/roomLight.test.tsx` covers that case.
jest.mock('../../world/WorldProvider', () => ({
  useWorld: () => ({
    room: 'road',
    recipe: { edge: 'rgba(10,11,16,0.9)', vignette: [0.5, 0.32] },
    light: { value: 0 },
    phase: 'day',
  }),
}));

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

function renderCard() {
  return render(<CandidateCard candidate={CANDIDATE} onRequest={jest.fn()} onSkip={jest.fn()} />);
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
 * The Road's light reaches the card now (`RoomLight`), which means a layer sits over a stranger's
 * photograph and gets darker as the day's match budget is spent. That is the point — but a design
 * idea does not get to make the one decision this screen exists for harder, so the falloff is
 * pinned to the edges and the face band stays clear at every light level.
 */
describe('CandidateCard under the room light', () => {
  it('is lit by the room it stands in', () => {
    expect(renderCard().getByTestId('room-light')).toBeTruthy();
  });

  it('never swallows a tap meant for the photo underneath', () => {
    expect(renderCard().getByTestId('room-light').props.pointerEvents).toBe('none');
  });

  it('leaves the middle of the card clear however dark the room gets', () => {
    const light = renderCard().getByTestId('room-light');
    // One gradient, not two: an animated alpha over more than one child forces Android to
    // composite the card offscreen for the whole transition.
    const gradients = light.findAllByType('ViewManagerAdapter_ExpoLinearGradient' as never);
    expect(gradients.length).toBe(1);
    for (const g of gradients) {
      const { colors, locations } = g.props as { colors: unknown[]; locations: number[] };
      // Both stops bounding the centre band are fully transparent, and that band covers the
      // middle of the card in each axis.
      const clear = locations
        .map((at, i) => ({ at, colour: colors[i] }))
        .filter((s) => s.at > 0 && s.at < 1);
      expect(clear).toHaveLength(2);
      expect(clear[0].at).toBeLessThanOrEqual(0.4);
      expect(clear[1].at).toBeGreaterThanOrEqual(0.6);
      // The native view takes processed colours, not strings, and `processColor('transparent')`
      // is 0 — so 0 here is the assertion that the stop is fully clear.
      for (const stop of clear) expect(stop.colour).toBe(0);
    }
  });
});
