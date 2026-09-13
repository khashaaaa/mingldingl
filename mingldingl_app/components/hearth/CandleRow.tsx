import { StyleSheet, Text, View } from 'react-native';
import { Glyph } from '../ui/Glyph';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, MATERIAL, SPACE } from '../../lib/theme';
import { i18n } from '../../lib/i18n';

/**
 * The day's summons budget, drawn as wax rather than a number. `docs/design/sealed-fire/boards/
 * Materials.dc.html` names the candle wax's one object; this is the first place it stands in a
 * row rather than alone.
 *
 * A stub is either lit (wax-coloured, full height, a small bright flame) or spent (muted, drawn
 * shorter — a candle that has burned down, not a candle that was never lit). One accessible node
 * for the whole row, the same call `SealDots` already makes: a line of identical unlabelled
 * glyphs read aloud one at a time tells a screen reader user nothing they can use, where the one
 * sentence `candles_left` says everything at once.
 */

/** Beyond this many the row folds into a "+N" — a misconfigured budget must not draw an
 *  unbounded line of candles. No budget this app actually sets comes close. */
const MAX_DRAWN = 16;

const LIT_SIZE = ICON_SIZES.lg;
/** Shorter than a lit stub, the way a candle that has burned down actually looks. */
const SPENT_SIZE = ICON_SIZES.md;

const FLAME_SIZE = 5;

interface Props {
  /** Summons left to spend today. */
  remaining: number;
  /** The day's whole ration. */
  budget: number;
}

export function CandleRow({ remaining, budget }: Props) {
  const drawn = Math.max(0, Math.min(budget, MAX_DRAWN));
  const overflow = Math.max(0, budget - drawn);
  const lit = Math.max(0, Math.min(remaining, drawn));

  return (
    <View
      testID="candle-row"
      style={styles.row}
      accessible
      accessibilityLabel={i18n.t('candles_left', { remaining, budget })}
    >
      {Array.from({ length: drawn }, (_, i) => {
        const isLit = i < lit;
        return (
          <View key={i} testID={isLit ? 'candle-lit' : 'candle-spent'} style={styles.stub}>
            <Glyph
              name="candle"
              size={isLit ? LIT_SIZE : SPENT_SIZE}
              color={isLit ? MATERIAL.wax : INK.muted}
            />
            {isLit && <View style={styles.flame} importantForAccessibility="no" />}
          </View>
        );
      })}
      {overflow > 0 && <Text style={styles.overflow}>{`+${overflow}`}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', gap: SPACE.xs },
  stub: { alignItems: 'center', justifyContent: 'flex-end' },
  flame: {
    position: 'absolute',
    top: 1,
    left: LIT_SIZE / 2 - FLAME_SIZE / 2,
    width: FLAME_SIZE,
    height: FLAME_SIZE,
    borderRadius: FLAME_SIZE / 2,
    backgroundColor: ACCENT.bright,
  },
  overflow: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.sm, color: INK.dim },
});
