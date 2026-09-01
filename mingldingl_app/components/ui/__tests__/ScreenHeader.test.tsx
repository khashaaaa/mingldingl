import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ScreenHeader } from '../ScreenHeader';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

describe('ScreenHeader', () => {
  beforeEach(() => {
    mockBack.mockClear();
  });

  it('renders the title and fires onBack when the back arrow is pressed', () => {
    const onBack = jest.fn();
    const { getByText, getByLabelText } = render(<ScreenHeader title="Guild Rank" onBack={onBack} />);

    expect(getByText('Guild Rank')).toBeTruthy();

    fireEvent.press(getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders the right slot when provided', () => {
    const { getByText } = render(
      <ScreenHeader title="Chat" onBack={() => {}} right={<Text>📹</Text>} />
    );
    expect(getByText('📹')).toBeTruthy();
  });

  it('calls router.back() when back arrow is pressed and no onBack prop is provided', () => {
    const { getByText, getByLabelText } = render(<ScreenHeader title="Guild Rank" />);

    expect(getByText('Guild Rank')).toBeTruthy();

    fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('labels the back arrow for screen readers via i18n', () => {
    const { getByLabelText } = render(<ScreenHeader title="Guild Rank" />);
    expect(getByLabelText('Back')).toBeTruthy();
  });
});
