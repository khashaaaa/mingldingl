import { fireEvent, render } from '@testing-library/react-native';
import { SatchelRow } from '../SatchelRow';
import { SATCHEL_IMAGES } from '../satchelImages';

const mockPush = jest.fn();
jest.mock('expo-router', () => require('../../../lib/testing/expoRouterMock').expoRouterMock({ useRouter: () => ({ push: mockPush }) }));

/** The painting is hidden from assistive tech (unlabelled), so the default queries skip it — the
 *  same opt-in the hearth's own frost tests use. */
const HIDDEN = { includeHiddenElements: true };

describe('SatchelRow', () => {
  beforeEach(() => {
    mockPush.mockClear();
  });

  it('draws the object itself, painted', () => {
    const { getByTestId } = render(
      <SatchelRow object="candles" name="Candles" line="3 of 5 left" to="/(tabs)/discover" />,
    );
    expect(getByTestId('satchel-art-candles', HIDDEN).props.source).toBe(SATCHEL_IMAGES.candles);
  });

  it('names the object and states its line', () => {
    const { getByText } = render(
      <SatchelRow object="candles" name="Candles" line="3 of 5 left" to="/(tabs)/discover" />,
    );
    expect(getByText('Candles')).toBeTruthy();
    expect(getByText('3 of 5 left')).toBeTruthy();
  });

  // The Tap groups its children under one accessible node (the global rule for a labelled group),
  // so the whole fact — what it is and its state — has to live in this one label.
  it('puts the whole fact in one accessibility label, the painting unlabelled', () => {
    const { getByLabelText, getByTestId } = render(
      <SatchelRow object="arrows" name="Arrows" line="Two await your answer" to="/(tabs)/matches" />,
    );
    expect(getByLabelText('Arrows. Two await your answer')).toBeTruthy();
    expect(getByTestId('satchel-art-arrows', HIDDEN).props.accessible).toBe(false);
  });

  it('goes where the object is used when tapped', () => {
    const { getByLabelText } = render(
      <SatchelRow object="key" name="The key" line="Held · The Hall" to="/membership" />,
    );
    fireEvent.press(getByLabelText('The key. Held · The Hall'));
    expect(mockPush).toHaveBeenCalledWith('/membership');
  });

  it('carries a testID through to the row for a screen to find it by', () => {
    const { getByTestId } = render(
      <SatchelRow
        object="card"
        name="Your card"
        line="Wanted, honestly kept"
        to="/(tabs)/profile"
        testID="satchel-row-card"
      />,
    );
    expect(getByTestId('satchel-row-card')).toBeTruthy();
  });
});
