import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { ParchmentFill } from '../ParchmentFill';
import { AppCard } from '../AppCard';
import { DialogStrip } from '../../modals/DialogSurface';

/**
 * `ParchmentFill` replaces two hand-copied gradient+texture pairs (`AppCard`'s hero branch and
 * `DialogStrip`) with one drawing. The two consumer tests below are what stop either from growing
 * its own copy back — the failure mode `hero.test.ts`'s own note describes for the knots.
 */

describe('ParchmentFill', () => {
  it('renders the texture once, marked decorative rather than left for a screen reader to find', () => {
    const { getByTestId, toJSON } = render(<ParchmentFill />);
    const texture = getByTestId('parchment-texture');
    expect(texture).toBeTruthy();
    expect(texture.props.pointerEvents).toBe('none');

    const root = toJSON() as { props: Record<string, unknown> };
    expect(root.props).toEqual(expect.objectContaining({
      accessible: false,
      importantForAccessibility: 'no',
      pointerEvents: 'none',
    }));
  });

  it('defaults the texture to 6% opacity', () => {
    const { getByTestId } = render(<ParchmentFill />);
    const texture = getByTestId('parchment-texture');
    expect(StyleSheet.flatten(texture.props.style).opacity).toBe(0.06);
  });

  it('takes the opacity it is given', () => {
    const { getByTestId } = render(<ParchmentFill opacity={0.2} />);
    const texture = getByTestId('parchment-texture');
    expect(StyleSheet.flatten(texture.props.style).opacity).toBe(0.2);
  });
});

/**
 * Both consumers used to query this testID with a plain `getByTestId`, never
 * `includeHiddenElements` — that has to keep working, which is why `ParchmentFill` stops at
 * `importantForAccessibility="no"` rather than reaching for `accessibilityElementsHidden`, the
 * prop that would take the whole subtree out of a default query along with it.
 */
describe('AppCard hero', () => {
  it('renders exactly one parchment texture, findable without includeHiddenElements', () => {
    const { getAllByTestId } = render(<AppCard hero><Text>body</Text></AppCard>);
    expect(getAllByTestId('parchment-texture')).toHaveLength(1);
  });
});

describe('DialogStrip', () => {
  it('renders exactly one parchment texture, findable without includeHiddenElements', () => {
    const { getAllByTestId } = render(<DialogStrip><Text>body</Text></DialogStrip>);
    expect(getAllByTestId('parchment-texture')).toHaveLength(1);
  });
});
