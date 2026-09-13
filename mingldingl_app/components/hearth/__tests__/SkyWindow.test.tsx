import { render } from '@testing-library/react-native';
import { SKY_GRADIENTS, SkyWindow } from '../SkyWindow';
import { ACCENT, INK, NIGHT, tint } from '../../../lib/theme';

const WIDTH = 340;
/** Frost is decorative, so it is hidden from assistive tech and from the default queries with it —
 *  the same opt-in `FrostEdge`'s own suite and `QuestTile`'s make. */
const HIDDEN = { includeHiddenElements: true };

describe('SkyWindow', () => {
  it('holds one gradient per phase, and it is the sky rather than a room colour', () => {
    // Pinned against the tokens, not against hex: the window is the *real* sky, so re-tuning
    // `NIGHT` or the gold has to carry the sky with it rather than leaving it behind.
    expect(SKY_GRADIENTS).toEqual({
      night: [NIGHT.black, NIGHT.blue],
      dawn: [NIGHT.blue, tint(ACCENT.bright, 0.5)],
      day: [NIGHT.blue, tint(INK.primary, 0.25)],
      dusk: [NIGHT.brown, NIGHT.black],
    });
  });

  it('hangs twelve stars at night', () => {
    const { getAllByTestId } = render(<SkyWindow phase="night" width={WIDTH} whiteMoon={false} />);
    expect(getAllByTestId('sky-star')).toHaveLength(12);
  });

  it('keeps the same twelve at dawn — they have not set yet', () => {
    const { getAllByTestId } = render(<SkyWindow phase="dawn" width={WIDTH} whiteMoon={false} />);
    expect(getAllByTestId('sky-star')).toHaveLength(12);
  });

  it('draws no star by day or at dusk', () => {
    const day = render(<SkyWindow phase="day" width={WIDTH} whiteMoon={false} />);
    expect(day.queryAllByTestId('sky-star')).toHaveLength(0);
    const dusk = render(<SkyWindow phase="dusk" width={WIDTH} whiteMoon={false} />);
    expect(dusk.queryAllByTestId('sky-star')).toHaveLength(0);
  });

  it('lights the horizon at dawn and at dusk, and only then', () => {
    for (const phase of ['dawn', 'dusk'] as const) {
      const { getByTestId } = render(<SkyWindow phase={phase} width={WIDTH} whiteMoon={false} />);
      expect(getByTestId('sky-glow')).toBeTruthy();
    }
    for (const phase of ['night', 'day'] as const) {
      const { queryByTestId } = render(<SkyWindow phase={phase} width={WIDTH} whiteMoon={false} />);
      expect(queryByTestId('sky-glow')).toBeNull();
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
