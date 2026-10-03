import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { InkDraw } from '../InkDraw';
import { GLYPH_DRAWS, GLYPH_DRAW_FRAMES } from '../glyphImages';
import { ICON_SIZES, INK } from '../../../lib/theme';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

const HIDDEN = { includeHiddenElements: true };

describe('InkDraw', () => {
  beforeEach(() => {
    mockLevel = 'plain';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('paints from the strip, one frame wide, in the colour it is given', () => {
    const { getByTestId, UNSAFE_getByProps } = render(<InkDraw name="chest-open" size={ICON_SIZES.splash} color={INK.primary} />);
    expect(StyleSheet.flatten(getByTestId('ink-draw-chest-open', HIDDEN).props.style)).toEqual(
      expect.objectContaining({ width: ICON_SIZES.splash, height: ICON_SIZES.splash, overflow: 'hidden' }),
    );
    const strip = UNSAFE_getByProps({ source: GLYPH_DRAWS['chest-open'] });
    expect(StyleSheet.flatten(strip.props.style)).toEqual(
      expect.objectContaining({ width: ICON_SIZES.splash * GLYPH_DRAW_FRAMES, tintColor: INK.primary }),
    );
  });

  it('shows the finished glyph when motion is held still', () => {
    mockLevel = 'still';
    const { queryByTestId, getByTestId } = render(<InkDraw name="chest-open" />);
    expect(queryByTestId('ink-draw-chest-open', HIDDEN)).toBeNull();
    expect(getByTestId('glyph-chest-open', HIDDEN)).toBeTruthy();
  });

  it('shows the finished glyph for a mark with no strip', () => {
    const { getByTestId } = render(<InkDraw name="bell" />);
    expect(getByTestId('glyph-bell', HIDDEN)).toBeTruthy();
  });
});
