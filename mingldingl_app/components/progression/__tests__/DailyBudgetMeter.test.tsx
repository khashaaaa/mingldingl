import { render } from '@testing-library/react-native';
import { DailyBudgetMeter } from '../DailyBudgetMeter';

describe('DailyBudgetMeter', () => {
  it('shows remaining-of-budget while summons are left', () => {
    const { getByText } = render(<DailyBudgetMeter budget={{ budget: 5, used: 2, remaining: 3 }} />);
    expect(getByText('3 of 5 summons left today')).toBeTruthy();
  });

  it('switches to the spent message when nothing is left', () => {
    const { getByText, queryByText } = render(<DailyBudgetMeter budget={{ budget: 5, used: 5, remaining: 0 }} />);
    expect(getByText('All summons spent — the realm rests until dawn')).toBeTruthy();
    expect(queryByText(/left today/)).toBeNull();
  });
});
