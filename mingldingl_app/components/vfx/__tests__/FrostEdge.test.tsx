import { render } from '@testing-library/react-native';
import { FrostEdge, type FrostEdgeEdge } from '../FrostEdge';
import { TEMPERATURE } from '../../../lib/theme';

/**
 * `FrostEdge` is not mounted anywhere in Wave 1 (Wave 3 places it) — this is a render smoke test
 * per edge, the same contract `Places.test.tsx` and `Glyph.test.tsx` hold their drawings to.
 */

const EDGES: readonly FrostEdgeEdge[] = ['top', 'bottom', 'left', 'right'];

/** A decorative drawing is hidden from the queries too, which is the point of it. */
const HIDDEN = { includeHiddenElements: true };

describe('FrostEdge', () => {
  it.each(EDGES)('renders the %s edge, hidden from assistive tech', (edge) => {
    const { getByTestId } = render(<FrostEdge edge={edge} />);
    const svg = getByTestId(`frost-edge-${edge}`, HIDDEN);
    expect(svg).toBeTruthy();
    expect(svg.props['aria-hidden']).toBe(true);
    expect(svg.props.importantForAccessibility).toBe('no');
    expect(svg.props.pointerEvents).toBe('none');
  });

  it('spans the full width on a horizontal edge and the full height on a vertical one', () => {
    const top = render(<FrostEdge edge="top" length={40} />).getByTestId('frost-edge-top', HIDDEN);
    expect(top.props.width).toBe('100%');
    expect(top.props.height).toBe(40);

    const left = render(<FrostEdge edge="left" length={40} />).getByTestId('frost-edge-left', HIDDEN);
    expect(left.props.width).toBe(40);
    expect(left.props.height).toBe('100%');
  });

  it('draws only in the three frost tokens, never a raw hex', () => {
    const { UNSAFE_root } = render(<FrostEdge edge="top" />);
    const strokes = new Set(
      UNSAFE_root.findAllByType(require('react-native-svg').Path).map((p: { props: { stroke?: string } }) => p.props.stroke),
    );
    for (const stroke of strokes) {
      expect([TEMPERATURE.rime, TEMPERATURE.ice, TEMPERATURE.glacier]).toContain(stroke);
    }
  });

  it('scales its opacity down without erasing the drawing', () => {
    const { UNSAFE_root } = render(<FrostEdge edge="top" opacity={0.4} />);
    const paths = UNSAFE_root.findAllByType(require('react-native-svg').Path);
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(path.props.opacity).toBeGreaterThan(0);
      expect(path.props.opacity).toBeLessThanOrEqual(0.6);
    }
  });
});
