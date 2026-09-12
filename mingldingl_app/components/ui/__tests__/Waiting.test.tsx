import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Waiting } from '../Waiting';
import { ICON_SIZES, INK } from '../../../lib/theme';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

/** Every drawn mark in a rendered tree. */
function marks(node: unknown): { type?: string; props?: Record<string, unknown> }[] {
  if (Array.isArray(node)) return node.flatMap(marks);
  if (!node || typeof node !== 'object') return [];
  const el = node as { type?: string; props?: Record<string, unknown>; children?: unknown };
  const here = /path|rect|circle|line/i.test(el.type ?? '') ? [el] : [];
  return [...here, ...marks(el.children)];
}

/** react-native-svg packs a colour into an ARGB int before it reaches the native view. */
function packed(hex: string) {
  return { type: 0, payload: 0xff000000 + parseInt(hex.slice(1), 16) };
}

describe('Waiting', () => {
  beforeEach(() => {
    mockLevel = 'plain';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('draws the candle at the requested size and tint', () => {
    const { getByTestId, toJSON } = render(<Waiting size={ICON_SIZES.xl} color={INK.primary} />);

    expect(StyleSheet.flatten(getByTestId('waiting-candle').props.style)).toEqual(
      expect.objectContaining({ width: ICON_SIZES.xl, height: ICON_SIZES.xl }),
    );
    // Every cut in the candle, wax and flame alike, is the colour it was handed — so the wait
    // inside a forged button still reads in that button's label metal.
    for (const mark of marks(toJSON())) {
      expect(mark.props?.stroke ?? mark.props?.fill).toEqual(packed(INK.primary));
    }
  });

  // A spinner is the one thing on screen saying "not frozen", so it must announce itself as
  // busy. It carries no text label on purpose — an untranslated English word is worse here than
  // the platform's own locale-aware "progress bar", which is what role+busy gets us.
  it('announces itself as busy', () => {
    const { getByTestId } = render(<Waiting />);
    const candle = getByTestId('waiting-candle');
    expect(candle.props.accessibilityRole).toBe('progressbar');
    expect(candle.props['aria-busy'] ?? candle.props.accessibilityState?.busy).toBe(true);
  });

  it('flickers the flame, and only the flame, while motion is allowed', () => {
    const { getByTestId } = render(<Waiting />);

    expect(StyleSheet.flatten(getByTestId('waiting-flame').props.style).transform).toBeTruthy();
    expect(jest.getTimerCount()).toBeGreaterThan(0);
  });

  it('starts no animation loop when motion is not allowed', () => {
    mockLevel = 'still';
    render(<Waiting />);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('holds the flame still rather than putting the candle out', () => {
    mockLevel = 'still';
    const { getByTestId, toJSON } = render(<Waiting />);

    expect(getByTestId('waiting-candle')).toBeTruthy();
    expect(StyleSheet.flatten(getByTestId('waiting-flame').props.style).transform).toBeUndefined();
    expect(marks(toJSON()).length).toBeGreaterThan(0);
  });
});
