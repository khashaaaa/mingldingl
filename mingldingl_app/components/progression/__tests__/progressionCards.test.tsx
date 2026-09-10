import { act, render } from '@testing-library/react-native';
import { DailyBudgetMeter } from '../DailyBudgetMeter';
import { ScoreHUD } from '../ScoreHUD';
import { ThreadLog } from '../ThreadLog';
import { XPBar } from '../XPBar';
import { TierPerkCard } from '../TierPerkCard';

jest.mock('../GemTierBadge', () => ({ GemTierBadge: () => null }));

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'full';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

beforeEach(() => {
  mockLevel = 'full';
  jest.useFakeTimers();
});
afterEach(() => {
  jest.useRealTimers();
});

describe('DailyBudgetMeter', () => {
  it('shows remaining-of-budget while summons are left', () => {
    const { getByText } = render(<DailyBudgetMeter budget={{ budget: 5, used: 2, remaining: 3 }} />);
    expect(getByText('3 of 5 summons left today')).toBeTruthy();
  });

  it('counts the remaining number down to the new value and keeps the sentence intact', () => {
    const { getByText, rerender } = render(<DailyBudgetMeter budget={{ budget: 5, used: 2, remaining: 3 }} />);
    rerender(<DailyBudgetMeter budget={{ budget: 5, used: 4, remaining: 1 }} />);
    act(() => { jest.runAllTimers(); });
    expect(getByText('1 of 5 summons left today')).toBeTruthy();
  });

  it('switches to the spent message when nothing is left', () => {
    const { getByText, queryByText } = render(<DailyBudgetMeter budget={{ budget: 5, used: 5, remaining: 0 }} />);
    expect(getByText('Out of new matches for today — more tomorrow')).toBeTruthy();
    expect(queryByText(/left today/)).toBeNull();
  });
});

describe('ThreadLog', () => {
  it('shows the empty state when no ship-milestone titles are owned', () => {
    const { getByText } = render(<ThreadLog ownedItemIds={[]} />);
    expect(getByText(/No threads woven yet/i)).toBeTruthy();
  });

  it('shows the Thread-Weaver title once earned', () => {
    const { getByText } = render(<ThreadLog ownedItemIds={['title_threadweaver']} />);
    expect(getByText('Thread-Weaver')).toBeTruthy();
  });

  it('shows all three milestone titles once earned, in ascending order', () => {
    const { getByText } = render(
      <ThreadLog ownedItemIds={['title_bondkeeper', 'title_threadweaver', 'title_fateseer']} />,
    );
    expect(getByText('Thread-Weaver')).toBeTruthy();
    expect(getByText('Fate-Seer')).toBeTruthy();
    expect(getByText('Bond-Keeper')).toBeTruthy();
  });
});

describe('XPBar next-tier threshold', () => {
  it('shows how many points remain to the next tier when a threshold is known', () => {
    const { getByText } = render(<XPBar gemTier="Garnet" totalScore={60} pct={0.6} nextTier="Opal" nextTierThreshold={100} />);
    expect(getByText('40 pts to Opal')).toBeTruthy();
    expect(getByText('60 pts')).toBeTruthy();
  });

  it('ticks both numbers to their new values when the score changes', () => {
    const { getByText, rerender } = render(<XPBar gemTier="Garnet" totalScore={60} pct={0.6} nextTier="Opal" nextTierThreshold={100} />);
    rerender(<XPBar gemTier="Garnet" totalScore={1075} pct={0.85} nextTier="Opal" nextTierThreshold={1100} />);
    act(() => { jest.runAllTimers(); });
    expect(getByText('25 pts to Opal')).toBeTruthy();
    expect(getByText('1,075 pts')).toBeTruthy();
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

describe('ScoreHUD', () => {
  // The float is hidden from assistive tech on purpose, which also hides it from RNTL's default
  // queries; these opt back in so the tests see the same tree the screen draws.
  const hidden = { includeHiddenElements: true };

  it('shows the score with separators and no delta on first render', () => {
    const { getByText, queryByTestId } = render(<ScoreHUD score={1240} tier="Garnet" />);
    expect(getByText('1,240')).toBeTruthy();
    expect(queryByTestId('score-delta', hidden)).toBeNull();
  });

  it('floats +N when the score rises, then removes it once the rise is over', () => {
    const { getByText, getByTestId, queryByTestId, rerender } = render(<ScoreHUD score={1240} tier="Garnet" />);
    rerender(<ScoreHUD score={1265} tier="Garnet" />);
    expect(getByTestId('score-delta', hidden).props.children).toBe('+25');
    act(() => { jest.runAllTimers(); });
    expect(getByText('1,265')).toBeTruthy();
    expect(queryByTestId('score-delta', hidden)).toBeNull();
  });

  it('floats −N when the score falls', () => {
    const { getByTestId, rerender } = render(<ScoreHUD score={100} tier="Garnet" />);
    rerender(<ScoreHUD score={90} tier="Garnet" />);
    expect(getByTestId('score-delta', hidden).props.children).toBe('−10');
  });

  it('jumps straight to the new score with no float under still', () => {
    mockLevel = 'still';
    const { getByText, queryByTestId, rerender } = render(<ScoreHUD score={100} tier="Garnet" />);
    rerender(<ScoreHUD score={150} tier="Garnet" />);
    expect(getByText('150')).toBeTruthy();
    expect(queryByTestId('score-delta', hidden)).toBeNull();
  });
});
