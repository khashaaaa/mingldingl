import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { AppCard } from '../AppCard';
import { SectionDivider } from '../SectionDivider';
import { useActiveFestival } from '../../../lib/festivals';

jest.mock('../../../lib/festivals', () => ({ useActiveFestival: jest.fn() }));

const mockFestival = useActiveFestival as jest.Mock;
const NAADAM = { key: 'naadam-2026', nameKey: 'festival_naadam', icon: 'bow-arrow', color: '#E0561F', start: '2026-07-11', end: '2026-07-13' };

describe('AppCard ornaments', () => {
  beforeEach(() => mockFestival.mockReturnValue(null));

  it('draws four untinted gold corner knots on an ordinary day', () => {
    const { getAllByTestId, getByText } = render(<AppCard><Text>body</Text></AppCard>);
    const corners = getAllByTestId('ulzii-corner');
    expect(corners).toHaveLength(4);
    for (const corner of corners) expect(StyleSheet.flatten(corner.props.style).tintColor).toBeUndefined();
    expect(getByText('body')).toBeTruthy();
  });

  it('tints every corner knot with the festival colour while a festival is on', () => {
    mockFestival.mockReturnValue(NAADAM);
    const { getAllByTestId } = render(<AppCard><Text>body</Text></AppCard>);
    for (const corner of getAllByTestId('ulzii-corner')) {
      expect(StyleSheet.flatten(corner.props.style).tintColor).toBe(NAADAM.color);
    }
  });
});

describe('SectionDivider ornament', () => {
  beforeEach(() => mockFestival.mockReturnValue(null));

  it('leaves the knot gold on an ordinary day', () => {
    const { getByTestId } = render(<SectionDivider />);
    expect(StyleSheet.flatten(getByTestId('ulzii-divider-knot').props.style).tintColor).toBeUndefined();
  });

  it('tints the knot with the festival colour while a festival is on', () => {
    mockFestival.mockReturnValue(NAADAM);
    const { getByTestId } = render(<SectionDivider />);
    expect(StyleSheet.flatten(getByTestId('ulzii-divider-knot').props.style).tintColor).toBe(NAADAM.color);
  });
});
