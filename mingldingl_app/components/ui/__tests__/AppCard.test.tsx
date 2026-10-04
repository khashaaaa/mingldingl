import { render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { AppCard } from '../AppCard';
import { SectionDivider } from '../SectionDivider';
import { SURFACE } from '../../../lib/theme';
import { useActiveFestival } from '../../../lib/festivals';

jest.mock('../../../lib/festivals', () => ({ useActiveFestival: jest.fn() }));

const mockFestival = useActiveFestival as jest.Mock;
const NAADAM = { key: 'naadam-2026', nameKey: 'festival_naadam', icon: 'bow-arrow', color: '#E0561F', start: '2026-07-11', end: '2026-07-13' };

describe('AppCard ornaments', () => {
  beforeEach(() => mockFestival.mockReturnValue(null));

  it('draws four untinted gold corner knots on the hero panel on an ordinary day', () => {
    const { getAllByTestId, getByText } = render(<AppCard hero><Text>body</Text></AppCard>);
    const corners = getAllByTestId('ulzii-corner');
    expect(corners).toHaveLength(4);
    for (const corner of corners) expect(StyleSheet.flatten(corner.props.style).tintColor).toBeUndefined();
    expect(getByText('body')).toBeTruthy();
  });

  it('gives the hero panel the parchment, and an ordinary card neither knots nor parchment', () => {
    const hero = render(<AppCard hero><Text>body</Text></AppCard>);
    expect(hero.getByTestId('parchment-texture')).toBeTruthy();

    const row = render(<AppCard><Text>body</Text></AppCard>);
    expect(row.queryAllByTestId('ulzii-corner')).toHaveLength(0);
    expect(row.queryByTestId('parchment-texture')).toBeNull();
    expect(row.getByText('body')).toBeTruthy();
  });

  it('lets the hero cast the only shadow — an ordinary card is flat on the floor', () => {
    // "Its glow is the only glow", and "no second panel, no nested card, no shadow" — the kit
    // board's rule for everything that is not the hero. The glow lives on the card's own style,
    // the bottom edge is a separate hairline View.
    const hero = render(<AppCard hero><Text>body</Text></AppCard>);
    const heroCard = StyleSheet.flatten(hero.getByTestId('app-card').props.style);
    expect(heroCard.shadowOpacity).toBeGreaterThan(0);
    expect(heroCard.elevation).toBeGreaterThan(0);
    expect(hero.getByTestId('card-bottom-shadow')).toBeTruthy();

    const row = render(<AppCard><Text>body</Text></AppCard>);
    const rowCard = StyleSheet.flatten(row.getByTestId('app-card').props.style);
    expect(rowCard.shadowOpacity).toBeUndefined();
    expect(rowCard.elevation).toBeUndefined();
    expect(rowCard.shadowColor).toBeUndefined();
    expect(row.queryByTestId('card-bottom-shadow')).toBeNull();
    // No panel either: an ordinary card is a ledger section — one hairline over it, no fill,
    // and its contents on the screen's gutter whatever padding the call site asked for.
    expect(rowCard.borderWidth).toBe(0);
    expect(rowCard.borderTopWidth).toBeGreaterThan(0);
    expect(rowCard.backgroundColor).toBe('transparent');
  });

  it('keeps its contents on the gutter even when the call site pads the card', () => {
    const row = render(<AppCard style={{ padding: 16 }}><Text>body</Text></AppCard>);
    const rowCard = StyleSheet.flatten(row.getByTestId('app-card').props.style);
    expect(rowCard.paddingHorizontal).toBe(0);
    expect(rowCard.paddingTop ?? rowCard.padding).toBe(16);
  });

  it('keeps the frame on a clipped card, which has art that runs to its edge', () => {
    const art = render(<AppCard clip><Text>sky</Text></AppCard>);
    const card = StyleSheet.flatten(art.getByTestId('app-card').props.style);
    expect(card.borderWidth).toBe(1);
    expect(card.backgroundColor).toBe(SURFACE.panel);
  });

  it('tints every corner knot with the festival colour while a festival is on', () => {
    mockFestival.mockReturnValue(NAADAM);
    const { getAllByTestId } = render(<AppCard hero><Text>body</Text></AppCard>);
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
