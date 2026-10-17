import { StyleSheet, Text, View } from 'react-native';
import { withAlpha } from '../effects';
import { color, dimension, effect } from '../tokens';
import { Txt } from './Txt';

const glow = effect.glowGold[0];

/**
 * A person's name, lit warm in the display face with their age set smaller in gold after it, and a
 * thin gold rule with a lozenge beneath. `text` is the localised "name, age" line; the part after
 * the name is the age suffix (the whole line stays one text, so it reads and is found as one).
 */
export function NameTitle({ name, text }: { name: string; text: string }) {
  const split = text.startsWith(name) ? name.length : text.length;
  return (
    <View style={styles.wrap}>
      <Txt
        variant="displayL"
        align="center"
        numberOfLines={1}
        adjustsFontSizeToFit
        style={styles.name}
        accessibilityRole="header"
      >
        {text.slice(0, split)}
        {split < text.length ? <Text style={styles.age}>{text.slice(split)}</Text> : null}
      </Txt>
      <View style={styles.rule}>
        <View style={styles.line} />
        <View style={styles.lozenge} />
        <View style={styles.line} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'stretch', alignItems: 'center', gap: dimension.space1 },
  name: {
    textShadowColor: withAlpha(glow.color, glow.opacity * 0.6),
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 12,
  },
  age: { fontSize: 22, color: color.textAccent, textShadowRadius: 0 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: dimension.space2 },
  line: { width: 56, height: 1, backgroundColor: withAlpha(color.borderGold, 0.6) },
  lozenge: {
    width: 6,
    height: 6,
    backgroundColor: color.accentGold,
    transform: [{ rotate: '45deg' }],
  },
});
