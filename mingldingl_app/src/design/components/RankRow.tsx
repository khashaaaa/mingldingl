import { StyleSheet, View } from 'react-native';
import { color, dimension } from '../tokens';
import { Art } from './Art';
import { GEM, GemBadge, type Tier } from './GemBadge';
import { Txt } from './Txt';

/** A carved line of the Hall of Names (Figma "Rank Row"): rank, gem, a name or "your torch", points. */
export function RankRow({
  rank,
  tier,
  name,
  points,
  you = false,
}: {
  rank: string;
  tier: Tier;
  name: string;
  points: string;
  you?: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${rank}. ${name}. ${points}`}
      style={[styles.row, you && styles.you]}
    >
      <Txt variant="numberS" color="textSecondary">
        {rank}
      </Txt>
      {you ? <GemBadge tier={tier} size={38} /> : <Art name={GEM[tier]} style={styles.gem} fit="contain" />}
      <Txt variant="bodyM" color={you ? 'textAccent' : 'textPrimary'} style={styles.name} numberOfLines={1}>
        {name}
      </Txt>
      <Txt variant="numberS" color="textAccent">
        {points}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space4,
    paddingHorizontal: dimension.sizeGutter,
    paddingVertical: dimension.space3,
    borderBottomWidth: dimension.strokeHairline,
    borderBottomColor: color.borderHairline,
  },
  you: {
    backgroundColor: color.bgPanel,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderGold,
  },
  gem: { width: 33, height: 33 },
  name: { flex: 1 },
});
