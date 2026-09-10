import { render, fireEvent, act } from '@testing-library/react-native';
import { Unsealing } from '../Unsealing';
import { signal } from '../../../lib/world/feedback';

jest.mock('../../../lib/world/feedback', () => ({ signal: jest.fn() }));

const PROPS = {
  onDismiss: jest.fn(),
  photoUri: 'https://example.test/a.jpg',
  headline: 'Сарнай',
  subline: 'Next reveal at 15 messages',
};

describe('Unsealing', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders nothing until a seal actually breaks', () => {
    const { queryByTestId } = render(<Unsealing {...PROPS} visible={false} />);
    expect(queryByTestId('unsealing')).toBeNull();
    expect(signal).not.toHaveBeenCalled();
  });

  it('shows the revealed photo and its copy', () => {
    const { getByTestId, getByText } = render(<Unsealing {...PROPS} visible />);
    expect(getByTestId('unsealing')).toBeTruthy();
    expect(getByTestId('unsealing-photo')).toBeTruthy();
    expect(getByText('Сарнай')).toBeTruthy();
    expect(getByText('Next reveal at 15 messages')).toBeTruthy();
  });

  it('breaks the seal on the body, not only on the screen', () => {
    jest.useFakeTimers();
    render(<Unsealing {...PROPS} visible />);
    // The haptic is deliberately on a timer, landing with the break rather than with the mount.
    expect(signal).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1000); });
    expect(signal).toHaveBeenCalledWith('sealBreak');
    jest.useRealTimers();
  });

  it('still reveals a rung that unlocked no photo', () => {
    const { getByTestId, queryByTestId } = render(<Unsealing {...PROPS} visible photoUri={null} />);
    expect(getByTestId('unsealing')).toBeTruthy();
    expect(queryByTestId('unsealing-photo')).toBeNull();
  });

  it('dismisses on a tap anywhere', () => {
    const onDismiss = jest.fn();
    const { getByTestId } = render(<Unsealing {...PROPS} visible onDismiss={onDismiss} />);
    fireEvent.press(getByTestId('unsealing'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
