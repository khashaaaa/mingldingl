import { render, fireEvent } from '@testing-library/react-native';
import { GettingStartedCard } from '../GettingStartedCard';
import { i18n } from '../../../lib/i18n';

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
});

/**
 * Regression for task-8: the full four-row board is what was squeezing the discover card's photo
 * band on first run — it stays full only while nothing is done yet (the zero-step case, covered
 * above); from the first completed step onward it collapses to a one-line progress summary,
 * reclaiming the column. The "tapping the completed profile row is a no-op" case from before this
 * change no longer applies: a completed profile step is itself one done step, so that scenario now
 * renders the compact summary, which has no profile row (and no touch target at all) to mis-tap —
 * the second test below asserts that directly instead.
 */
describe('GettingStartedCard collapsed once started', () => {
  it('collapses to a one-line progress summary once any single step is done', () => {
    const { getByTestId, getByText, queryByText } = render(
      <GettingStartedCard
        isProfileComplete={true}
        achievedMilestoneIds={['first_match', 'first_icebreaker']}
        onCompleteProfile={() => {}}
      />,
    );
    expect(getByTestId('getting-started-compact')).toBeTruthy();
    // The eyebrow survives the collapse — it's the one piece of the full board reused verbatim.
    expect(getByText('FIRST STEPS')).toBeTruthy();
    // 3 of the 4 steps are done (profile, match, icebreaker) — reuses the existing
    // "%{held} of %{needed}" key rather than a new one.
    expect(getByText(i18n.t('honour_progress', { held: 3, needed: 4 }))).toBeTruthy();
    // None of the full board's per-step rows (or their touch targets) render once collapsed.
    expect(queryByText('Complete your profile')).toBeNull();
    expect(queryByText('Forge your first bond')).toBeNull();
    expect(queryByText('Break the ice')).toBeNull();
    expect(queryByText('Take the compatibility trial')).toBeNull();
  });

  it('has no completed-profile row to mistap once collapsed, so onCompleteProfile can never misfire', () => {
    const onCompleteProfile = jest.fn();
    const { queryByText } = render(
      <GettingStartedCard isProfileComplete={true} achievedMilestoneIds={[]} onCompleteProfile={onCompleteProfile} />,
    );
    expect(queryByText('Complete your profile')).toBeNull();
    expect(onCompleteProfile).not.toHaveBeenCalled();
  });

  it('collapses on the very first step done, not only once several are', () => {
    const { getByTestId, getByText } = render(
      <GettingStartedCard isProfileComplete={true} achievedMilestoneIds={[]} onCompleteProfile={() => {}} />,
    );
    expect(getByTestId('getting-started-compact')).toBeTruthy();
    expect(getByText(i18n.t('honour_progress', { held: 1, needed: 4 }))).toBeTruthy();
  });
});
