import { Pressable, StyleSheet, View } from 'react-native';
import { feedback } from '@/lib/feedback';
import type { ArtName } from '../art/manifest';
import { color, dimension } from '../tokens';
import { Art } from './Art';
import { AvatarFrame } from './AvatarFrame';
import type { SealablePhoto } from './PhotoTile';
import { Txt } from './Txt';

/** A bond in the Quest Log (Figma 26:322): portrait, name, the last line, how long ago, unread dot. */
export function BondRow({
  name,
  line,
  ago,
  portrait,
  sealed,
  unread,
  faded,
  emblem,
  onPress,
}: {
  name: string;
  line: string;
  ago: string;
  portrait: SealablePhoto | null;
  sealed: boolean;
  unread: boolean;
  faded?: boolean;
  /** A painted coin in place of a portrait (a Fated Thread's row). */
  emblem?: ArtName;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${line}. ${ago}`}
      onPressIn={() => feedback('press')}
      onPress={onPress}
      style={[styles.row, faded && styles.faded]}
    >
      {emblem ? (
        <Art name={emblem} style={styles.emblem} fit="cover" />
      ) : (
        <AvatarFrame state={sealed ? 'sealed' : 'revealed'} photo={portrait} label={name} size={48} />
      )}
      <View style={styles.text}>
        <Txt variant="displayS" numberOfLines={1}>
          {name}
        </Txt>
        <Txt variant="voiceM" color="textSecondary" numberOfLines={1}>
          {line}
        </Txt>
      </View>
      <View style={styles.meta}>
        <Txt variant="labelS" color="textMuted">
          {ago}
        </Txt>
        {unread ? <View testID="unread" style={styles.dot} /> : <View style={styles.dotSpace} />}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  emblem: { width: 48, height: 48, borderRadius: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space3,
    minHeight: 72,
    paddingVertical: dimension.space2,
    paddingHorizontal: dimension.sizeGutter,
    borderBottomWidth: dimension.strokeHairline,
    borderBottomColor: color.borderHairline,
  },
  faded: { opacity: 0.6 },
  text: { flex: 1, gap: 2 },
  meta: { alignItems: 'flex-end', gap: dimension.space2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: color.accentEmber },
  dotSpace: { height: 8 },
});
