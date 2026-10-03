import { Image } from 'react-native';
import { render } from '@testing-library/react-native';
import { FrostEdge, type FrostEdgeEdge } from '../FrostEdge';
import { TEMPERATURE } from '../../../lib/theme';

/** A render smoke test per edge, the same contract `Places.test.tsx` and `Glyph.test.tsx` hold their drawings to. */

const EDGES: readonly FrostEdgeEdge[] = ['top', 'bottom', 'left', 'right'];

/** A decorative drawing is hidden from the queries too, which is the point of it. */
const HIDDEN = { includeHiddenElements: true };

const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...([style] as unknown[]).flat(Infinity).filter(Boolean));

describe('FrostEdge', () => {
  it.each(EDGES)('renders the %s edge, hidden from assistive tech', (edge) => {
    const { getByTestId } = render(<FrostEdge edge={edge} />);
    const frost = getByTestId(`frost-edge-${edge}`, HIDDEN);
    expect(frost.props['aria-hidden']).toBe(true);
    expect(frost.props.importantForAccessibility).toBe('no-hide-descendants');
    expect(frost.props.pointerEvents).toBe('none');
  });

  it('spans the full width on a horizontal edge and the full height on a vertical one', () => {
    const top = flat(render(<FrostEdge edge="top" length={40} />).getByTestId('frost-edge-top', HIDDEN).props.style);
    expect(top.width).toBe('100%');
    expect(top.height).toBe(40);

    const left = flat(render(<FrostEdge edge="left" length={40} />).getByTestId('frost-edge-left', HIDDEN).props.style);
    expect(left.width).toBe(40);
    expect(left.height).toBe('100%');
  });

  it('tiles the ice along the edge at a size set by its reach', () => {
    const tiles = render(<FrostEdge edge="top" length={24} />).UNSAFE_getAllByType(Image);
    expect(tiles.length).toBeGreaterThan(3);
    expect(flat(tiles[0].props.style)).toMatchObject({ width: 72, height: 24 });
  });

  it('is tinted only in the three frost tokens, never a raw hex', () => {
    const tints = new Set(render(<FrostEdge edge="top" />).UNSAFE_getAllByType(Image).map((i) => flat(i.props.style).tintColor));
    expect([...tints].sort()).toEqual([TEMPERATURE.rime, TEMPERATURE.ice, TEMPERATURE.glacier].sort());
  });

  it('scales its opacity down without erasing the drawing', () => {
    for (const tile of render(<FrostEdge edge="top" opacity={0.4} />).UNSAFE_getAllByType(Image)) {
      const { opacity } = flat(tile.props.style) as { opacity: number };
      expect(opacity).toBeGreaterThan(0);
      expect(opacity).toBeLessThanOrEqual(0.4);
    }
  });

  it('flips the baked tile for the bottom and right edges', () => {
    expect(JSON.stringify(render(<FrostEdge edge="bottom" />).getByTestId('frost-edge-bottom', HIDDEN).props.style)).toContain('scaleY');
    expect(JSON.stringify(render(<FrostEdge edge="right" />).getByTestId('frost-edge-right', HIDDEN).props.style)).toContain('scaleX');
  });
});
