import { render } from '@testing-library/react-native';
import { SKY_PAINTINGS, SkyWindow } from '../SkyWindow';

const WIDTH = 340;
/** Frost is decorative, so it is hidden from assistive tech and from the default queries with it —
 *  the same opt-in `FrostEdge`'s own suite and `QuestTile`'s make. */
const HIDDEN = { includeHiddenElements: true };

describe('SkyWindow', () => {
  it('shows its own painting for each hour', () => {
    const phases = ['night', 'dawn', 'day', 'dusk'] as const;
    // Four distinct pictures: the same place, never the same light twice.
    expect(new Set(phases.map((p) => SKY_PAINTINGS[p])).size).toBe(4);
    for (const phase of phases) {
      const { getByTestId } = render(<SkyWindow phase={phase} width={WIDTH} whiteMoon={false} />);
      expect(getByTestId(`sky-${phase}`).props.source).toBe(SKY_PAINTINGS[phase]);
    }
  });

  it('rims the window top and bottom with frost on White Moon', () => {
    const { getByTestId } = render(<SkyWindow phase="night" width={WIDTH} whiteMoon />);
    expect(getByTestId('frost-edge-top', HIDDEN)).toBeTruthy();
    expect(getByTestId('frost-edge-bottom', HIDDEN)).toBeTruthy();
  });

  it('leaves the glass bare the rest of the year', () => {
    const { queryByTestId } = render(<SkyWindow phase="night" width={WIDTH} whiteMoon={false} />);
    expect(queryByTestId('frost-edge-top', HIDDEN)).toBeNull();
    expect(queryByTestId('frost-edge-bottom', HIDDEN)).toBeNull();
  });

  it('is one accessible node, named for the hour it shows', () => {
    const spoken = { night: 'Night.', dawn: 'Dawn.', day: 'Day.', dusk: 'Dusk.' } as const;
    for (const [phase, label] of Object.entries(spoken)) {
      const { getByTestId } = render(
        <SkyWindow phase={phase as keyof typeof spoken} width={WIDTH} whiteMoon={false} />,
      );
      const window = getByTestId('sky-window');
      expect(window.props.accessible).toBe(true);
      expect(window.props.accessibilityLabel).toBe(label);
    }
  });
});
