import { fireEvent, render } from '@testing-library/react-native';
import { SatchelRow } from '../SatchelRow';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

/** The material mark and the glyph inside it are hidden from assistive tech (unlabelled), so the
 *  default queries skip them — the same opt-in the hearth's own frost tests use. */
const HIDDEN = { includeHiddenElements: true };

describe('SatchelRow', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('draws the object in its material, glyph included', () => {
    const { getByTestId } = render(
      <SatchelRow material="wax" glyph="candle" name="Candles" line="3 of 5 left" to="/(tabs)/discover" />,
    );
    expect(getByTestId('material-wax', HIDDEN)).toBeTruthy();
    expect(getByTestId('glyph-candle', HIDDEN)).toBeTruthy();
  });

  it('names the object and states its line', () => {
    const { getByText } = render(
      <SatchelRow material="wax" glyph="candle" name="Candles" line="3 of 5 left" to="/(tabs)/discover" />,
    );
    expect(getByText('Candles')).toBeTruthy();
    expect(getByText('3 of 5 left')).toBeTruthy();
  });

  // The Tap groups its children under one accessible node (the global rule for a labelled group),
  // so the whole fact — what it is and its state — has to live in this one label.
  it('puts the whole fact in one accessibility label, the material mark unlabelled', () => {
    const { getByLabelText, getByTestId } = render(
      <SatchelRow material="wood" glyph="pledge" name="Arrows" line="Two await your answer" to="/(tabs)/matches" />,
    );
    expect(getByLabelText('Arrows. Two await your answer')).toBeTruthy();
    expect(getByTestId('material-wood', HIDDEN).props.accessible).toBe(false);
  });

  it('goes where the object is used when tapped', () => {
    const { getByLabelText } = render(
      <SatchelRow material="gold" glyph="knot" name="The key" line="Held · The Hall" to="/membership" />,
    );
    fireEvent.press(getByLabelText('The key. Held · The Hall'));
    expect(mockPush).toHaveBeenCalledWith('/membership');
  });

  it('carries a testID through to the row for a screen to find it by', () => {
    const { getByTestId } = render(
      <SatchelRow
        material="parchment"
        glyph="gem"
        name="Your card"
        line="Wanted, honestly kept"
        to="/(tabs)/profile"
        testID="satchel-row-card"
      />,
    );
    expect(getByTestId('satchel-row-card')).toBeTruthy();
  });
});
