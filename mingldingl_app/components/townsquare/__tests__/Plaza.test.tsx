import { render } from '@testing-library/react-native';
import { Plaza } from '../Plaza';

const WIDTH = 320;
/** Every drawn stroke is decorative under the plaza's one accessible label, the same opt-in
 *  `SkyWindow`'s own suite uses to reach past that. */
const HIDDEN = { includeHiddenElements: true };

describe('Plaza', () => {
  it('lights one glow per lantern', () => {
    const { getAllByTestId } = render(<Plaza width={WIDTH} lanterns={7} mine={false} open />);
    expect(getAllByTestId('plaza-lantern')).toHaveLength(7);
  });

  it('caps the drawn glows at 24 even when the gathering seated more', () => {
    const { getAllByTestId } = render(<Plaza width={WIDTH} lanterns={40} mine={false} open />);
    expect(getAllByTestId('plaza-lantern')).toHaveLength(24);
  });

  it('marks the last glow YOU when the viewer lit one', () => {
    const { getByTestId } = render(<Plaza width={WIDTH} lanterns={3} mine open />);
    expect(getByTestId('plaza-you', HIDDEN)).toBeTruthy();
  });

  it('draws no YOU mark for a viewer who has not lit a lantern', () => {
    const { queryByTestId } = render(<Plaza width={WIDTH} lanterns={3} mine={false} open />);
    expect(queryByTestId('plaza-you', HIDDEN)).toBeNull();
  });

  it('draws no YOU mark when nobody has lit a lantern yet, even for the viewer', () => {
    const { queryByTestId } = render(<Plaza width={WIDTH} lanterns={0} mine open />);
    expect(queryByTestId('plaza-you', HIDDEN)).toBeNull();
  });

  it('bars both gates shut once the square is locked', () => {
    const { getAllByTestId } = render(<Plaza width={WIDTH} lanterns={0} mine={false} open={false} />);
    expect(getAllByTestId('plaza-gate-bar', HIDDEN)).toHaveLength(2);
  });

  it('leaves the gates bare — no bar — while RSVP is open', () => {
    const { queryAllByTestId } = render(<Plaza width={WIDTH} lanterns={0} mine={false} open />);
    expect(queryAllByTestId('plaza-gate-bar', HIDDEN)).toHaveLength(0);
  });

  it('walks the same seeded path every render — a live gathering is not a slot machine', () => {
    const a = render(<Plaza width={WIDTH} lanterns={9} mine={false} open />);
    const first = a.getAllByTestId('plaza-lantern').map((n) => [n.props.cx, n.props.cy]);
    a.unmount();
    const b = render(<Plaza width={WIDTH} lanterns={9} mine={false} open />);
    const second = b.getAllByTestId('plaza-lantern').map((n) => [n.props.cx, n.props.cy]);
    expect(second).toEqual(first);
  });

  it('never sets a lantern down on the bell', () => {
    const { getAllByTestId, getByTestId } = render(
      <Plaza width={WIDTH} lanterns={24} mine={false} open />,
    );
    const bell = getByTestId('plaza-bell');
    const bellR = Number(bell.props.r);
    const bellCx = Number(bell.props.cx);
    const bellCy = Number(bell.props.cy);
    for (const lantern of getAllByTestId('plaza-lantern')) {
      const dx = Number(lantern.props.cx) - bellCx;
      const dy = Number(lantern.props.cy) - bellCy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeGreaterThanOrEqual(bellR + Number(lantern.props.r));
    }
  });

  it('labels the whole drawing as one accessible image, yours among them', () => {
    const { getByTestId } = render(<Plaza width={WIDTH} lanterns={5} mine open />);
    const plaza = getByTestId('plaza');
    expect(plaza.props.accessible).toBe(true);
    expect(plaza.props.accessibilityRole).toBe('image');
    expect(plaza.props.accessibilityLabel).toBe('5 lanterns lit. Yours among them.');
  });

  it('labels the drawing plainly when the viewer has not lit one', () => {
    const { getByTestId } = render(<Plaza width={WIDTH} lanterns={5} mine={false} open />);
    expect(getByTestId('plaza').props.accessibilityLabel).toBe('5 lanterns lit.');
  });

  it('labels an empty plaza as empty', () => {
    const { getByTestId } = render(<Plaza width={WIDTH} lanterns={0} mine={false} open />);
    expect(getByTestId('plaza').props.accessibilityLabel).toBe('No lantern lit yet.');
  });
});
