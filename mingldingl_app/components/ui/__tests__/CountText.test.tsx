import { act, render } from '@testing-library/react-native';
import { CountText } from '../CountText';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'full';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

describe('CountText', () => {
  beforeEach(() => {
    mockLevel = 'full';
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the value at once on first render, formatted with separators', () => {
    const { getByText } = render(<CountText value={1234} />);
    expect(getByText('1,234')).toBeTruthy();
  });

  it('labels itself with the final value so screen readers never hear a frame', () => {
    const { getByText, rerender } = render(<CountText value={10} />);
    rerender(<CountText value={90} />);
    expect(getByText('10').props.accessibilityLabel).toBe('90');
  });

  it('ticks from the previous value and ends on the new one', () => {
    const { getByText, queryByText, rerender } = render(<CountText value={10} duration={600} />);
    rerender(<CountText value={90} duration={600} />);
    // Still on the old value the instant the prop changes — nothing jumps.
    expect(getByText('10')).toBeTruthy();

    act(() => { jest.advanceTimersByTime(200); });
    const mid = Number(queryByText(/^\d+$/)?.props.children);
    expect(mid).toBeGreaterThan(10);
    expect(mid).toBeLessThan(90);

    act(() => { jest.runAllTimers(); });
    expect(getByText('90')).toBeTruthy();
  });

  it('applies a custom format to every frame', () => {
    const { getByText, rerender } = render(<CountText value={3} format={(n) => `${n} of 5`} />);
    expect(getByText('3 of 5')).toBeTruthy();
    rerender(<CountText value={1} format={(n) => `${n} of 5`} />);
    act(() => { jest.runAllTimers(); });
    expect(getByText('1 of 5')).toBeTruthy();
  });

  it('renders the new value instantly under still', () => {
    mockLevel = 'still';
    const { getByText, rerender } = render(<CountText value={10} />);
    rerender(<CountText value={90} />);
    expect(getByText('90')).toBeTruthy();
  });

  it('renders the new value instantly under off', () => {
    mockLevel = 'off';
    const { getByText, rerender } = render(<CountText value={10} />);
    rerender(<CountText value={90} />);
    expect(getByText('90')).toBeTruthy();
  });
});
