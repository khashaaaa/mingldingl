import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { FONTS, FONT_SIZES, INK, LEADING, SPACE } from '../../lib/theme';

/**
 * The line the app says under a screen's title, before anything else on it. Italic, because
 * italic is the app speaking. Six screens wrote it out by hand (2026-10-04) in three sizes, with
 * and without leading, one of them upright — so the same voice looked like three.
 */
export function ScreenLede({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.lede, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  lede: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.md,
    lineHeight: LEADING.md,
    color: INK.dim,
    marginBottom: SPACE.lg,
  },
});
