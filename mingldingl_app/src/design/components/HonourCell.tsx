import { Pressable, StyleSheet, View } from 'react-native';
import { feedback } from '@/lib/feedback';
import type { ArtName } from '../art/manifest';
import { boxShadow } from '../effects';
import { dimension } from '../tokens';
import { Art } from './Art';
import { Txt } from './Txt';

/** One place in the honour case (Figma "Honour Cell"): the emblem glowing, or a dim coin and "???". */
export function HonourCell({
  emblem,
  name,
  earned,
  onPress,
}: {
  emblem: ArtName;
  name: string;
  earned: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={earned ? 'button' : 'image'}
      accessibilityLabel={name}
      disabled={!earned}
      onPressIn={() => feedback('press')}
      onPress={onPress}
      style={styles.cell}
    >
      <View style={[styles.emblem, earned ? styles.lit : styles.dim]}>
        <Art name={earned ? emblem : 'honour_locked'} style={styles.emblem} fit="cover" />
      </View>
      <Txt variant="labelS" color={earned ? 'textPrimary' : 'textMuted'} align="center" numberOfLines={4}>
        {earned ? breakAfterHyphens(name.toUpperCase()) : '???'}
      </Txt>
    </Pressable>
  );
}

/**
 * Android's line breaker will not wrap after a hyphen in a long compound ("Холбоо-Хамгаалагч")
 * and splits the word mid-letter instead; a zero-width space after the hyphen gives it the break.
 */
const breakAfterHyphens = (text: string) => text.replace(/-(?=\S)/g, '-\u200B');

const styles = StyleSheet.create({
  cell: {
    width: 104,
    minHeight: 112,
    alignItems: 'center',
    gap: dimension.space2,
    paddingVertical: dimension.space3,
  },
  emblem: { width: 64, height: 64, borderRadius: 32 },
  lit: { boxShadow: boxShadow('glowGold') },
  dim: { opacity: 0.3 },
});
