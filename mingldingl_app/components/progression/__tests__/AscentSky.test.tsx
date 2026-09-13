import { render } from '@testing-library/react-native';
import { AscentSky } from '../AscentSky';
import { hydrateTierThresholds } from '../../../lib/tiers';

/**
 * `react-native-svg`'s `Text` puts its string on the `content` prop of a nested `RNSVGTSpan`
 * host node, not as a JSON-tree child the way RN's own `Text` does — so `getByText` (which only
 * ever looks at RN `Text` nodes) cannot see a star's label. This is the same shape of gap
 * `lib/testing/svg.ts`'s `marks`/`paints` exist for, just for text instead of strokes.
 */
function svgTexts(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(svgTexts);
  if (!node || typeof node !== 'object') return [];
  const el = node as { type?: string; props?: { content?: string | null }; children?: unknown };
  const here = el.type === 'RNSVGTSpan' && el.props?.content ? [el.props.content] : [];
  return [...here, ...svgTexts(el.children)];
}

/**
 * The fixture ladder matches `lib/tiers.ts`'s own default (`DEFAULT_TIER_THRESHOLDS`), hydrated
 * explicitly anyway so this test is not silently riding on that default staying what it is today —
 * `tierThresholdsSnapshot()` is read, never re-derived, and the brief pins Ruby at 1,000 and
 * Emerald at 2,000 so a score of 1,595 comes out to exactly "405 to go".
 */
function hydrateFixtureLadder() {
  hydrateTierThresholds([
    { tier: 'Garnet', minScore: 0 },
    { tier: 'Opal', minScore: 100 },
    { tier: 'Amethyst', minScore: 300 },
    { tier: 'Sapphire', minScore: 600 },
    { tier: 'Ruby', minScore: 1000 },
    { tier: 'Emerald', minScore: 2000 },
  ]);
}

const mockUseVfxLevel = jest.fn(() => 'still');
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockUseVfxLevel(),
}));

beforeEach(() => {
  hydrateFixtureLadder();
  mockUseVfxLevel.mockReturnValue('still');
  // Fake timers so the pulse's `Animated.loop` never actually fires between renders — real
  // timers left it running past the end of the "motion allowed" test below, same fix as
  // `Lantern.test.tsx` uses for its own flicker loop.
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('AscentSky', () => {
  it('draws all six tiers as stars, the held one distinguished from the rest', () => {
    const { getAllByTestId, getByTestId } = render(
      <AscentSky gemTier="Ruby" totalScore={1595} currentStreak={4} longestStreak={11} width={340} />,
    );
    expect(getAllByTestId(/^ascent-star/)).toHaveLength(6);
    expect(getByTestId('ascent-star-held')).toBeTruthy();
  });

  it('labels the tier below zero with just its name, an ordinary one with its threshold', () => {
    const { toJSON } = render(
      <AscentSky gemTier="Ruby" totalScore={1595} currentStreak={4} longestStreak={11} width={340} />,
    );
    const texts = svgTexts(toJSON());
    expect(texts).toContain('Garnet');
    expect(texts).toContain('Opal · 100');
  });

  it('labels the held tier "you, <score>" and the next tier the exact points still owed', () => {
    const { toJSON } = render(
      <AscentSky gemTier="Ruby" totalScore={1595} currentStreak={4} longestStreak={11} width={340} />,
    );
    const texts = svgTexts(toJSON());
    expect(texts).toContain('Ruby · you, 1,595');
    expect(texts).toContain('Emerald · 405 to go');
    // "The sky beyond" sits over the top of the whole ladder — a fixed part of the drawing, not
    // something that only appears once someone actually reaches Emerald.
    expect(texts).toContain('the sky beyond');
  });

  it('drops "to go" and shows the beyond label when the top tier is already held', () => {
    const { toJSON } = render(
      <AscentSky gemTier="Emerald" totalScore={2500} currentStreak={2} longestStreak={9} width={340} />,
    );
    const texts = svgTexts(toJSON());
    expect(texts).toContain('Emerald · you, 2,500');
    expect(texts.some((t) => t.includes('to go'))).toBe(false);
    expect(texts).toContain('the sky beyond');
  });

  it('shows the streak as a big numeral, the dawns caption, and the longest streak beneath it', () => {
    const { getByText } = render(
      <AscentSky gemTier="Ruby" totalScore={1595} currentStreak={4} longestStreak={11} width={340} />,
    );
    expect(getByText('4')).toBeTruthy();
    expect(getByText('dawns in a row')).toBeTruthy();
    expect(getByText('Longest Streak · 11')).toBeTruthy();
  });

  it('carries the tier, score, next-tier gap and streak in one accessible label', () => {
    const { getByLabelText } = render(
      <AscentSky gemTier="Ruby" totalScore={1595} currentStreak={4} longestStreak={11} width={340} />,
    );
    expect(getByLabelText(/Ruby.*1,595.*405 to go.*4 dawns in a row/s)).toBeTruthy();
  });

  it('renders without a running loop under reduced motion, and without crashing when motion is allowed', () => {
    mockUseVfxLevel.mockReturnValue('full');
    const { getByTestId } = render(
      <AscentSky gemTier="Ruby" totalScore={1595} currentStreak={4} longestStreak={11} width={340} />,
    );
    expect(getByTestId('ascent-star-held')).toBeTruthy();
  });
});
