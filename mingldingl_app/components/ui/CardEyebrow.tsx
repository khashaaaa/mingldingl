import { Text, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { FONTS, FONT_SIZES, INK, SPACE, TRACKING } from '../../lib/theme';
interface Props {
  children: string;
  color?: string;
  style?: StyleProp<TextStyle>;
}

// The small tracked label that titles a card or a section. Set in the small-caps
// utility face — the display serif turns to mush at this size — and uppercased
// here so call sites never have to remember to do it.
export function CardEyebrow({ children, color = INK.dim, style }: Props) {
  return <Text style={[styles.eyebrow, { color }, style]}>{children.toUpperCase()}</Text>;
}

const styles = StyleSheet.create({
  eyebrow: {
    fontFamily: FONTS.utility,
    fontSize: FONT_SIZES.xs,
    letterSpacing: TRACKING.eyebrow,
    marginBottom: SPACE.sm,
    // Mongolian runs longer than English at the same tracking; shrink inside a flex
    // row rather than clip against a sibling.
    flexShrink: 1,
  },
});
