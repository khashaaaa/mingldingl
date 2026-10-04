import { View, Image, StyleSheet } from 'react-native';
import { INK, SPACE, metalGradient } from '../../lib/theme';
import { ORNAMENTS } from '../../lib/ornaments';
import { useActiveFestival } from '../../lib/festivals';
import { BRUSH_RULE } from './brushImages';

interface Props {
  tint?: string;
}

/** Every gold rule in the app carries the knot — the header's too (it ran plain for a day, 2026-10-04). */
export function SectionDivider({ tint = INK.muted }: Props) {
  const [bright] = metalGradient(tint);
  const festival = useActiveFestival();
  const knotTint = festival ? { tintColor: festival.color } : undefined;
  return (
    <View style={styles.row}>
      {/* One dry-brushed rule each side, swelling from a hair at the margin to full at the knot, its
          streaks breaking where the brush ran dry (`scripts/gen-brush.js`). Tinted, so the metal
          still carries. */}
      <Image source={BRUSH_RULE} resizeMode="stretch" style={[styles.line, { tintColor: bright }]} />
      <Image source={ORNAMENTS.knotGold} testID="ulzii-divider-knot" style={[styles.knot, knotTint]} />
      <Image source={BRUSH_RULE} resizeMode="stretch" style={[styles.line, styles.mirrored, { tintColor: bright }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginVertical: SPACE.sm },
  line: { flex: 1, height: 6, opacity: 0.85 },
  mirrored: { transform: [{ scaleX: -1 }] },
  knot: { width: 15, height: 15, opacity: 0.9 },
});
