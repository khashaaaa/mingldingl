import { render } from '@testing-library/react-native';
import { DayHeading } from '../DayHeading';
import { formatDate } from '../../../lib/formatDate';

describe('DayHeading', () => {
  it('names the day in words, uppercased, and falls back to the date', () => {
    expect(render(<DayHeading day={3} iso="2026-09-12T00:00:00Z" />).getByText('THE THIRD DAY')).toBeTruthy();
    const { getByText } = render(<DayHeading day={null} iso="2026-09-12T00:00:00Z" />);
    expect(getByText(formatDate('2026-09-12T00:00:00Z').toUpperCase())).toBeTruthy();
  });
});
