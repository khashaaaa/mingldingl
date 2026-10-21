import { Pressable, StyleSheet, View } from 'react-native';
import { feedback } from '@/lib/feedback';
import { boxShadow } from '../effects';
import type { GlyphName } from '../glyphs';
import { color, dimension } from '../tokens';
import { Glyph } from './Art';
import { CornerCaps } from './Hardware';
import { Txt } from './Txt';

/** One of a few exclusive choices (gender, oath); the glyph is left out where the choices are only words (a riddle's answers). Selected: gold frame, glow, brass corners. */
export function ChoiceCard({
  glyph,
  title,
  body,
  selected,
  onPress,
}: {
  glyph?: GlyphName;
  title: string;
  body: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityHint={body}
      accessibilityState={{ checked: selected }}
      onPressIn={() => feedback('press')}
      onPress={onPress}
      style={[styles.card, selected ? styles.selected : styles.idle]}
    >
      {glyph ? <Glyph name={glyph} size={32} tint={selected ? 'accentGoldBright' : 'textSecondary'} /> : null}
      <View style={styles.text}>
        <Txt variant="displayS">{title}</Txt>
        <Txt variant="bodyS" color="textSecondary">
          {body}
        </Txt>
      </View>
      {selected && <CornerCaps />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space4,
    padding: 18,
    borderRadius: dimension.radiusSm,
    alignSelf: 'stretch',
  },
  idle: {
    backgroundColor: color.bgRaised,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderHairline,
  },
  selected: {
    backgroundColor: color.bgPanel,
    borderWidth: dimension.strokeRule,
    borderColor: color.borderGold,
    boxShadow: boxShadow('glowGold'),
  },
  text: { flex: 1, gap: dimension.space1 },
});
