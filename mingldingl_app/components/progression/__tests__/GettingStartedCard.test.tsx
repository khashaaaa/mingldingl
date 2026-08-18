import { render, fireEvent } from '@testing-library/react-native';
import { GettingStartedCard } from '../GettingStartedCard';

describe('GettingStartedCard', () => {
  it('renders all four steps as incomplete for a brand-new user', () => {
    const { getByText } = render(
      <GettingStartedCard isProfileComplete={false} achievedMilestoneIds={[]} onCompleteProfile={() => {}} />,
    );
    expect(getByText('FIRST STEPS')).toBeTruthy();
    expect(getByText('Complete your profile')).toBeTruthy();
    expect(getByText('Forge your first bond')).toBeTruthy();
    expect(getByText('Break the ice')).toBeTruthy();
    expect(getByText('Take the compatibility trial')).toBeTruthy();
  });

  it('tapping the profile row calls onCompleteProfile while the profile step is incomplete', () => {
    const onCompleteProfile = jest.fn();
    const { getByText } = render(
      <GettingStartedCard isProfileComplete={false} achievedMilestoneIds={[]} onCompleteProfile={onCompleteProfile} />,
    );
    fireEvent.press(getByText('Complete your profile'));
    expect(onCompleteProfile).toHaveBeenCalledTimes(1);
  });

  it('tapping the profile row is a no-op once the profile step is already complete', () => {
    const onCompleteProfile = jest.fn();
    const { getByText } = render(
      <GettingStartedCard isProfileComplete={true} achievedMilestoneIds={[]} onCompleteProfile={onCompleteProfile} />,
    );
    fireEvent.press(getByText('Complete your profile'));
    expect(onCompleteProfile).not.toHaveBeenCalled();
  });

  it('renders nothing once all four steps are complete', () => {
    const { queryByText } = render(
      <GettingStartedCard
        isProfileComplete={true}
        achievedMilestoneIds={['first_match', 'first_icebreaker', 'first_quiz']}
        onCompleteProfile={() => {}}
      />,
    );
    expect(queryByText('FIRST STEPS')).toBeNull();
  });

  it('still renders while any single step remains incomplete', () => {
    const { getByText } = render(
      <GettingStartedCard
        isProfileComplete={true}
        achievedMilestoneIds={['first_match', 'first_icebreaker']}
        onCompleteProfile={() => {}}
      />,
    );
    expect(getByText('FIRST STEPS')).toBeTruthy();
  });
});
