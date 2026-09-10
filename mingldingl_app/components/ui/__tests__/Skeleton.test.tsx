import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Skeleton, SkeletonRows } from '../Skeleton';
import { RADIUS } from '../../../lib/theme';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

describe('Skeleton', () => {
  // The block is hidden from assistive tech on purpose, which also hides it from RNTL's default
  // queries (see progressionCards.test.tsx's `ScoreHUD` float for the same pattern); this opts
  // back in so the tests see the same tree the screen draws.
  const hidden = { includeHiddenElements: true };

  beforeEach(() => {
    mockLevel = 'plain';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('takes the exact box it is given, so the real row does not shift the layout', () => {
    const { getByTestId } = render(<Skeleton width={120} height={18} />);
    // `StyleSheet.flatten` first: this is the house convention (see primitives.test.tsx,
    // AppCard.test.tsx) and it reads correctly whether the style arrives as an array or an
    // already-flattened object.
    expect(StyleSheet.flatten(getByTestId('skeleton-block', hidden).props.style)).toEqual(
      expect.objectContaining({ width: 120, height: 18, borderRadius: RADIUS.sm }),
    );
  });

  it('accepts a percentage width', () => {
    const { getByTestId } = render(<Skeleton width="60%" height={18} />);
    expect(StyleSheet.flatten(getByTestId('skeleton-block', hidden).props.style)).toEqual(
      expect.objectContaining({ width: '60%' }),
    );
  });

  it('hides itself from the screen reader — it is a placeholder, not content', () => {
    const { getByTestId } = render(<Skeleton width={120} height={18} />);
    expect(getByTestId('skeleton-block', hidden).props.accessibilityElementsHidden).toBe(true);
  });

  it('starts no loop when motion is not allowed', () => {
    mockLevel = 'still';
    render(<Skeleton width={120} height={18} />);
    expect(jest.getTimerCount()).toBe(0);
  });
});

describe('SkeletonRows', () => {
  // See the `Skeleton` describe block above: the blocks are hidden from assistive tech on
  // purpose, which also hides them from RNTL's default queries.
  const hidden = { includeHiddenElements: true };

  beforeEach(() => {
    mockLevel = 'plain';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('repeats the row shape the requested number of times', () => {
    const { getAllByTestId } = render(
      <SkeletonRows count={4} row={() => <Skeleton width="100%" height={64} />} />,
    );
    expect(getAllByTestId('skeleton-block', hidden)).toHaveLength(4);
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
