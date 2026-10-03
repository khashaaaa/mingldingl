import { render, fireEvent } from '@testing-library/react-native';
import { BondTrialCard } from '../BondTrialCard';

jest.mock('../../../lib/world/feedback', () => ({ signal: jest.fn() }));

const base = {
  kind: 'exchange', weekStart: '2026-09-28T00:00:00Z', endsAt: '2026-10-05T00:00:00Z',
  target: 5, myProgress: 5, theirProgress: 2, complete: false, claimed: false, reward: 25,
};

describe('BondTrialCard', () => {
  it('shows both sides of the exchange and the reward, with no claim until both are full', () => {
    const { getByText, queryByText } = render(<BondTrialCard trial={base} onClaim={() => {}} isClaiming={false} />);
    expect(getByText('The Exchange')).toBeTruthy();
    expect(getByText('5/5')).toBeTruthy();
    expect(getByText('2/5')).toBeTruthy();
    expect(getByText('Worth +25 to each of you.')).toBeTruthy();
    expect(queryByText(/CLAIM/)).toBeNull();
  });

  it('offers the claim once both sides are full', () => {
    const onClaim = jest.fn();
    const { getByText } = render(
      <BondTrialCard trial={{ ...base, theirProgress: 5, complete: true }} onClaim={onClaim} isClaiming={false} />,
    );
    fireEvent.press(getByText('CLAIM +25 FOR YOU BOTH'));
    expect(onClaim).toHaveBeenCalledTimes(1);
  });

  it('says it is passed once claimed', () => {
    const { getByText } = render(
      <BondTrialCard trial={{ ...base, theirProgress: 5, complete: true, claimed: true }} onClaim={() => {}} isClaiming={false} />,
    );
    expect(getByText('Passed. The reward is in both your ledgers.')).toBeTruthy();
  });

  it('draws the rite as one shared deed, not two bars', () => {
    const { getByText, queryByText } = render(
      <BondTrialCard trial={{ ...base, kind: 'rite', target: 1, myProgress: 0, theirProgress: 0 }} onClaim={() => {}} isClaiming={false} />,
    );
    expect(getByText('The Rite')).toBeTruthy();
    expect(queryByText('0/1')).toBeNull();
  });
});
