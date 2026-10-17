import { Pressable, StyleSheet, View } from 'react-native';
import type { GlyphName } from '../glyphs';
import { color, dimension } from '../tokens';
import { Glyph } from './Art';
import { Txt } from './Txt';

/**
 * Figma Next Action (30:99): the one thing a bond can do next — a panel with a gold edge on the
 * left, its glyph in gold, a title and a line, and a chevron ("Break the ice").
 */
export function NextAction({
  glyph,
  title,
  body,
  onPress,
}: {
  glyph: GlyphName;
  title: string;
  body: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Glyph name={glyph} size={28} tint="textAccent" />
      <View style={styles.text}>
        <Txt variant="displayS">{title}</Txt>
        <Txt variant="bodyS" color="textSecondary">
          {body}
        </Txt>
      </View>
      <Glyph name="chevron" size={16} tint="textSecondary" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: dimension.space4,
    borderLeftWidth: 3,
    borderColor: color.borderGold,
    backgroundColor: color.bgPanel,
    alignSelf: 'stretch',
  },
  pressed: { backgroundColor: color.bgRaised },
  text: { flex: 1, gap: 2 },
});
