import { render, fireEvent } from '@testing-library/react-native';
import { Share } from 'react-native';
import { InviteAllyCard } from '../InviteAllyCard';

jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  Object.defineProperty(RN, 'Share', { value: { share: jest.fn() }, configurable: true });
  return RN;
});

describe('InviteAllyCard', () => {
  it('renders the referral code', () => {
    const { getByText } = render(<InviteAllyCard referralCode="FOX392" />);
    expect(getByText('FOX392')).toBeTruthy();
  });

  it('shares an invite message containing the code when pressed', () => {
    const { getAllByText } = render(<InviteAllyCard referralCode="FOX392" />);

    const matches = getAllByText(/Invite an Ally/i);
    fireEvent.press(matches[matches.length - 1]);
    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('FOX392') }),
    );
  });

  it('renders nothing when no code is available yet', () => {
    const { queryByText } = render(<InviteAllyCard referralCode={null} />);
    expect(queryByText(/Invite an Ally/i)).toBeNull();
  });
});
