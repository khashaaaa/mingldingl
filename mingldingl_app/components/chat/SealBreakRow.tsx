import { View, Text, StyleSheet } from 'react-native';
import { Glyph } from '../ui/Glyph';
import { i18n } from '../../lib/i18n';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, SPACE } from '../../lib/theme';

interface Props {
  /** Which seal broke — 2, 3 or 4 (the deep seal). */
  level: number;
}

/**
 * The ledger's own announcement of a broken seal, italic because it is the app speaking rather
 * than either person in the thread — the same voice `SealsSheet`'s law reads in.
 */
export function SealBreakRow({ level }: Props) {
  return (
    <View style={styles.row}>
      <Glyph name="seal" size={ICON_SIZES.sm} />
      <Text style={styles.text}>{i18n.t(`seal_broke_${level}`)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.xs,
    marginBottom: SPACE.md,
    paddingHorizontal: SPACE.lg,
  },
  text: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.sm,
    color: ACCENT.base,
    textAlign: 'center',
    flexShrink: 1,
  },
});
