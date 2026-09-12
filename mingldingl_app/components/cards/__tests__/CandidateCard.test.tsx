import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
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
 * file asserts theme roles against flat surfaces; this asserts one line of copy against its own
 * composited scrim, which is a different worst case (see `veiledPlate` below).
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
 * The ground the hint is actually read on, at its worst.
 *
 * The likeness is blurred, and a blur does not darken anything — a white-wall portrait stays white
 * under a 26px radius. So the worst case is white composited under the veil at the alpha the veil
 * has *where the hint sits*, and the veil is a linear ramp down the card: `SCRIM.veil` (0.55) at
 * the top to `SCRIM.veilStrong` (0.75) at the foot, i.e. `0.55 + 0.20 * f`.
 *
 * `f = 0.4`. The seal stack (a 120px knot, the dots, one 12px line, two `SPACE.sm` gaps) is
 * centred in the card *minus* the plaque, and the hint is its last line — about 74px below the
 * centre of that space. On the shortest card with the tallest plaque that lands near two fifths
 * down, which is the shallowest, i.e. lightest, ground the hint can sit on; anywhere lower is
 * darker and easier. The plaque gradient darkens this band further and is ignored here, so the
 * measurement is a floor rather than an estimate.
 */
const VEIL_ALPHA_AT_HINT = 0.55 + 0.2 * 0.4;
function veiledPlate(): [number, number, number] {
  const scrim: [number, number, number] = [10, 11, 16];
  const white: [number, number, number] = [255, 255, 255];
  return [0, 1, 2].map(
    (i) => white[i] * (1 - VEIL_ALPHA_AT_HINT) + scrim[i] * VEIL_ALPHA_AT_HINT,
  ) as [number, number, number];
}

const CANDIDATE: Candidate = {
  id: 'c1', displayName: 'Эрдэнэбат', age: 33, gender: 'male', city: 'Songinokhairkhan',
  bio: 'Vet.', photoUrls: ['https://example.com/a.jpg', 'https://example.com/b.jpg'],
  membershipLevel: 'Free', isProfileComplete: true, pushEnabled: true,
  ageMin: 18, ageMax: 99, isPaused: false, oath: 'Bond', oathProven: true,
  oathEncountersHeld: null, oathEncountersNeeded: null, deletionGraceDays: 14,
  deletionRequestedAt: null, preferredLocale: 'en', gemTier: 'Ruby',
} as Candidate;

function renderCard() {
  return render(<CandidateCard candidate={CANDIDATE} onRequest={jest.fn()} onSkip={jest.fn()} />);
}

/**
 * Move 1 of the Sealed Fire: the Fire stopped being a photo browser. A stranger arrives as a
 * blurred likeness under wax, and the face is earned in the thread — so the paging taps are gone
 * and the blur is not decoration, it is the mechanic drawn.
 */
describe('CandidateCard, sealed', () => {
  it('blurs the likeness under a labelled seal and offers no way to page the photos', () => {
    const { getByTestId, getByLabelText, queryByLabelText } = renderCard();
    expect(getByTestId('sealed-likeness').props.blurRadius).toBe(26);
    expect(getByLabelText('Their likeness, under wax')).toBeTruthy();
    expect(getByLabelText('Three seals, all intact')).toBeTruthy();
    expect(queryByLabelText('Next photo')).toBeNull();
    expect(queryByLabelText('Previous photo')).toBeNull();
  });

  it('says the name, the age, and one eyebrow of gem · district · oath', () => {
    const { getByText } = renderCard();
    expect(getByText('Эрдэнэбат, 33')).toBeTruthy();
    expect(getByText(/RUBY · SONGINOKHAIRKHAN · SWORN TO A BOND/)).toBeTruthy();
    expect(getByText('Three seals. Earn the face.')).toBeTruthy();
  });

  it('states the law legibly over the brightest plate it can land on', () => {
    // Read off the rendered node, not off a token: the point is that this component cannot quietly
    // go back to a dim ink, which is what it shipped with (2.3:1 here).
    const hint = renderCard().getByText('Three seals. Earn the face.');
    const { color } = StyleSheet.flatten(hint.props.style) as { color: string };
    expect(contrastRgb(hexToRgb(color), veiledPlate())).toBeGreaterThanOrEqual(4.5);
  });

  it('says an unproven oath as a search rather than a vow', () => {
    const { getByText } = render(
      <CandidateCard
        candidate={{ ...CANDIDATE, oathProven: false }}
        onRequest={jest.fn()}
        onSkip={jest.fn()}
      />,
    );
    expect(getByText(/SEEKING A BOND/)).toBeTruthy();
  });

  it('leaves the separators out of an eyebrow with nothing to separate', () => {
    const { getByText } = render(
      <CandidateCard
        candidate={{ ...CANDIDATE, city: '', oath: null }}
        onRequest={jest.fn()}
        onSkip={jest.fn()}
      />,
    );
    expect(getByText('RUBY')).toBeTruthy();
  });

  it('keeps one forged Summon and an ink Dismiss', () => {
    const onRequest = jest.fn();
    const onSkip = jest.fn();
    const { getByText } = render(
      <CandidateCard candidate={CANDIDATE} onRequest={onRequest} onSkip={onSkip} />,
    );
    fireEvent.press(getByText('SUMMON'));
    fireEvent.press(getByText('Dismiss'));
    expect(onRequest).toHaveBeenCalled();
    expect(onSkip).toHaveBeenCalled();
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
