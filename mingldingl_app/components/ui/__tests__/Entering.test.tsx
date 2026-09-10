import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { Entering, ENTER_CAP } from '../Entering';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

describe('Entering', () => {
  beforeEach(() => {
    mockLevel = 'plain';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('renders its child', () => {
    const { getByText } = render(<Entering index={0}><Text>a row</Text></Entering>);
    expect(getByText('a row')).toBeTruthy();
  });

  it('starts no animation under reduce-motion, leaving the row at rest', () => {
    mockLevel = 'still';
    const { getByTestId } = render(<Entering index={3}><Text>a row</Text></Entering>);
    expect(jest.getTimerCount()).toBe(0);
    // `style` is an object here, not an array. `opacity` started life as an `Animated.Value`, but
    // React Native's `createAnimatedPropsHook` resolves animated props to their current plain
    // value before they ever reach the underlying host node's props (`reduceAnimatedProps` calls
    // `node.__getValueWithStaticProps`, unconditionally, on every render) — so by the time
    // `StyleSheet.flatten` sees it here, `opacity` is already the number 1, not an `Animated.Value`
    // with a `.__getValue()` method.
    expect(StyleSheet.flatten(getByTestId('entering').props.style).opacity).toBe(1);
  });

  // A hundred-row list must not animate a tail nobody has scrolled to, and a row past the cap
  // must not be invisible while it waits its turn.
  it('does not delay rows past the cap', () => {
    const { getByTestId } = render(<Entering index={ENTER_CAP + 5}><Text>a row</Text></Entering>);
    expect(StyleSheet.flatten(getByTestId('entering').props.style).opacity).toBe(1);
  });
});
