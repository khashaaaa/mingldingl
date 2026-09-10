import { render, fireEvent } from '@testing-library/react-native';
import { DeletionPendingBanner } from '../DeletionPendingBanner';

describe('DeletionPendingBanner', () => {
  // MatchEligibility drops a pending-deletion account from every discovery feed and from the
  // leaderboard, so the app goes quiet while looking entirely normal. Until the engine stopped
  // cancelling deletion on a profile read this state was transient; now it lasts the whole grace
  // period, and Settings was the only screen that ever showed it.
  it('says how long is left and that the character is hidden meanwhile', () => {
    const { getByText } = render(
      <DeletionPendingBanner graceDays={7} onCancel={() => {}} isCancelling={false} />,
    );

    expect(getByText('Deletion pending')).toBeTruthy();
    expect(getByText('This character is scheduled to be erased in 7 days.')).toBeTruthy();
    expect(
      getByText('While this is pending you are hidden from Discover and the leaderboard, and nobody can be matched with you.'),
    ).toBeTruthy();
  });

  it('offers a way to call it off', () => {
    const onCancel = jest.fn();
    const { getByText } = render(
      <DeletionPendingBanner graceDays={7} onCancel={onCancel} isCancelling={false} />,
    );

    fireEvent.press(getByText('KEEP MY CHARACTER'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
