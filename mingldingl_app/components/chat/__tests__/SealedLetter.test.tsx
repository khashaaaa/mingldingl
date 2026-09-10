import { act, fireEvent, render } from '@testing-library/react-native';
import { SealedLetter } from '../SealedLetter';
import { signal } from '../../../lib/world/feedback';

jest.mock('../../../lib/world/feedback', () => ({ signal: jest.fn() }));

let mockLevel = 'full';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

describe('SealedLetter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLevel = 'full';
  });
  afterEach(() => jest.useRealTimers());

  it('shows the hint and names itself as a button', () => {
    const { getByText, getByTestId } = render(<SealedLetter onOpen={jest.fn()} />);
    expect(getByText('A first word, sealed. Tap to break the wax.')).toBeTruthy();
    const button = getByTestId('sealed-letter');
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBe('A first word, sealed. Tap to break the wax.');
  });

  it('ticks on the tap and opens once the wax has broken and the card unfolded', () => {
    jest.useFakeTimers();
    const onOpen = jest.fn();
    const { getByTestId } = render(<SealedLetter onOpen={onOpen} />);

    fireEvent.press(getByTestId('sealed-letter'));
    expect(signal).toHaveBeenCalledWith('press');
    expect(onOpen).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(1000); });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('breaks the wax only once however many times it is tapped', () => {
    jest.useFakeTimers();
    const onOpen = jest.fn();
    const { getByTestId } = render(<SealedLetter onOpen={onOpen} />);

    fireEvent.press(getByTestId('sealed-letter'));
    fireEvent.press(getByTestId('sealed-letter'));
    act(() => { jest.advanceTimersByTime(1000); });

    expect(signal).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('opens at once under reduce-motion, still with the tick', () => {
    mockLevel = 'still';
    const onOpen = jest.fn();
    const { getByTestId } = render(<SealedLetter onOpen={onOpen} />);

    fireEvent.press(getByTestId('sealed-letter'));
    expect(signal).toHaveBeenCalledWith('press');
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
