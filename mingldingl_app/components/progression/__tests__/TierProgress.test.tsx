import { render } from '@testing-library/react-native';
import { XPBar } from '../XPBar';
import { TierPerkCard } from '../TierPerkCard';

jest.mock('../GemTierBadge', () => ({ GemTierBadge: () => null }));

describe('XPBar next-tier threshold', () => {
  it('shows how many points remain to the next tier when a threshold is known', () => {
    const { getByText } = render(<XPBar gemTier="Garnet" totalScore={60} pct={0.6} nextTier="Opal" nextTierThreshold={100} />);
    expect(getByText('40 pts to Opal')).toBeTruthy();
  });

  it('omits the threshold line at the top tier or when the threshold is unknown', () => {
    const { queryByText, rerender } = render(<XPBar gemTier="Emerald" totalScore={9000} pct={1} nextTier={null} nextTierThreshold={null} />);
    expect(queryByText(/pts to/)).toBeNull();
    rerender(<XPBar gemTier="Garnet" totalScore={60} pct={0.6} nextTier="Opal" />);
    expect(queryByText(/pts to/)).toBeNull();
  });
});

describe('TierPerkCard daily budget', () => {
  it('shows the daily summons budget when provided', () => {
    const { getByText } = render(<TierPerkCard gemTier="Garnet" tierBonus={0} nextTier="Opal" dailyMatchBudget={5} />);
    expect(getByText('Daily summons: 5')).toBeTruthy();
  });

  it('renders without the budget line when it is not provided', () => {
    const { queryByText } = render(<TierPerkCard gemTier="Garnet" tierBonus={0} nextTier="Opal" />);
    expect(queryByText(/Daily summons/)).toBeNull();
  });
});
