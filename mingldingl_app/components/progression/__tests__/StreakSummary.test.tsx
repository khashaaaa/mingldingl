import { render } from '@testing-library/react-native';
import { StreakSummary } from '../StreakSummary';

jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => 'still',
}));

describe('StreakSummary', () => {
  it('shows the current streak as lantern flames and the longest streak as a number', () => {
    const { getByText, queryAllByTestId } = render(<StreakSummary currentStreak={4} longestStreak={11} />);
    expect(getByText('CURRENT STREAK')).toBeTruthy();
    expect(queryAllByTestId('flame-lit')).toHaveLength(4);
    expect(getByText('4 of 7 dawns')).toBeTruthy();
    expect(getByText('LONGEST STREAK')).toBeTruthy();
    expect(getByText('11')).toBeTruthy();
  });
});
