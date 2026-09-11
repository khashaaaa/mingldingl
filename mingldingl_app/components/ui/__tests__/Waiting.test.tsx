import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Waiting } from '../Waiting';
import { ICON_SIZES, INK } from '../../../lib/theme';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

describe('Waiting', () => {
  beforeEach(() => {
    mockLevel = 'plain';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('draws the knot at the requested size and tint', () => {
    const { getByTestId } = render(<Waiting size={ICON_SIZES.xl} color={INK.primary} />);
    expect(StyleSheet.flatten(getByTestId('waiting-knot').props.style)).toEqual(
      expect.objectContaining({ width: ICON_SIZES.xl, height: ICON_SIZES.xl, tintColor: INK.primary }),
    );
  });

  // A spinner is the one thing on screen saying "not frozen", so it must announce itself as
  // busy. It carries no text label on purpose — an untranslated English word is worse here than
  // the platform's own locale-aware "progress bar", which is what role+busy gets us.
  it('announces itself as busy', () => {
    const { getByTestId } = render(<Waiting />);
    const knot = getByTestId('waiting-knot');
    expect(knot.props.accessibilityRole).toBe('progressbar');
    expect(knot.props['aria-busy'] ?? knot.props.accessibilityState?.busy).toBe(true);
  });

  it('starts no animation loop when motion is not allowed', () => {
    mockLevel = 'still';
    render(<Waiting />);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('renders at rest under still rather than vanishing', () => {
    mockLevel = 'still';
    const { getByTestId } = render(<Waiting />);
    expect(getByTestId('waiting-knot')).toBeTruthy();
  });
});
