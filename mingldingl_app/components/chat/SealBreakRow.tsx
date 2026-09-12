import { View, Text, StyleSheet } from 'react-native';
import { Glyph } from '../ui/Glyph';
import { i18n } from '../../lib/i18n';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, SPACE } from '../../lib/theme';

interface Props {
  /** Which seal broke — 2, 3 or 4 (the deep seal). */
  level: number;
  /** The deep seal broke but the engine withheld the fields behind it: a Free member's paywall. */
  gated?: boolean;
}

/**
 * The ledger's own announcement of a broken seal, italic because it is the app speaking rather
 * than either person in the thread — the same voice `SealsSheet`'s law reads in.
 *
 * The deep seal is the one rung the conversation alone does not buy: the engine hands those fields
 * to Silver and Gold only. Announcing "their deep profile is yours now" to a Free member promised
 * something the sheet then shows under wax, so a gated break names the gate instead — the same
 * sentence `SealsSheet` uses for it.
 */
export function SealBreakRow({ level, gated = false }: Props) {
  return (
    <View style={styles.row}>
      <Glyph name="seal" size={ICON_SIZES.sm} />
      <Text style={styles.text}>
        {level === 4 && gated ? i18n.t('seals_deep_membership') : i18n.t(`seal_broke_${level}`)}
      </Text>
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
