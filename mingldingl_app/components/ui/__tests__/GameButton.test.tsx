import { render, fireEvent } from '@testing-library/react-native';
import { GameButton } from '../GameButton';
import { signal } from '../../../lib/world/feedback';

jest.mock('../../../lib/world/feedback', () => ({ signal: jest.fn() }));

const signalMock = signal as jest.Mock;

describe('GameButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ticks once on press-in and calls through on press', () => {
    const onPress = jest.fn();
    const { getByText } = render(<GameButton onPress={onPress}>Forge</GameButton>);
    const label = getByText('FORGE');
    fireEvent(label, 'pressIn');
    fireEvent(label, 'pressOut');
    fireEvent.press(label);
    expect(signalMock).toHaveBeenCalledTimes(1);
    expect(signalMock).toHaveBeenCalledWith('press');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says nothing when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<GameButton onPress={onPress} disabled>Forge</GameButton>);
    const label = getByText('FORGE');
    fireEvent(label, 'pressIn');
    fireEvent.press(label);
    expect(signalMock).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('says nothing while loading', () => {
    const { getByRole } = render(<GameButton onPress={() => {}} loading>Forge</GameButton>);
    fireEvent(getByRole('button'), 'pressIn');
    expect(signalMock).not.toHaveBeenCalled();
  });
});
