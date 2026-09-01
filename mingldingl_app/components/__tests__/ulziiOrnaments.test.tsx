import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { SectionDivider } from '../ui/SectionDivider';
import { QuestBanner } from '../quest/QuestBanner';
import { XPBar } from '../progression/XPBar';
import { CharacterCard } from '../cards/CharacterCard';
import OathSigil from '../OathSigil';

jest.mock('../progression/GemTierBadge', () => ({ GemTierBadge: () => null }));

describe('ulzii ornament layer', () => {
  it('AppCard seals its four corners with knots instead of brackets', () => {
    const { getAllByTestId } = render(<AppCard><Text>content</Text></AppCard>);
    expect(getAllByTestId('ulzii-corner')).toHaveLength(4);
  });

  it('SectionDivider centers a knot, not a diamond glyph', () => {
    const { getByTestId, queryByText } = render(<SectionDivider />);
    expect(getByTestId('ulzii-divider-knot')).toBeTruthy();
    expect(queryByText('◆')).toBeNull();
  });

  it('QuestBanner keeps its meaningful icon by default', () => {
    const { queryByTestId } = render(
      <QuestBanner icon="target" title="Break the Ice" onPress={() => {}} />,
    );
    expect(queryByTestId('ulzii-medallion')).toBeNull();
  });

  it('QuestBanner renders a knot medallion when asked', () => {
    const { getByTestId } = render(
      <QuestBanner icon="map" title="Campaign Map" onPress={() => {}} medallion="knot" />,
    );
    expect(getByTestId('ulzii-medallion')).toBeTruthy();
  });

  it('XPBar walks: dim fret on the track, dark fret engraved on the fill', () => {
    const { getByTestId } = render(
      <XPBar gemTier="Garnet" totalScore={60} pct={0.6} nextTier="Opal" nextTierThreshold={100} />,
    );
    expect(getByTestId('ulzii-track-fret')).toBeTruthy();
    expect(getByTestId('ulzii-fill-fret')).toBeTruthy();
  });

  it('CharacterCard wears the woven frame with knot-locked corners', () => {
    const { getAllByTestId } = render(
      <CharacterCard displayName="Сарнай" gemTier="Sapphire" totalScore={748} currentStreak={12} />,
    );
    expect(getAllByTestId('ulzii-frame-edge')).toHaveLength(4);
    expect(getAllByTestId('ulzii-frame-corner')).toHaveLength(4);
  });

  it('OathSigil marks each oath with its own knot image', () => {
    const bond = render(<OathSigil oath="Bond" proven={false} />);
    expect(bond.getByTestId('oath-sigil-Bond')).toBeTruthy();
    const fate = render(<OathSigil oath="Fate" proven />);
    expect(fate.getByTestId('oath-sigil-Fate')).toBeTruthy();
    const kin = render(<OathSigil oath="Kinship" proven={false} />);
    expect(kin.getByTestId('oath-sigil-Kinship')).toBeTruthy();
  });
});
