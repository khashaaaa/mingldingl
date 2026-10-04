import { View, Image, StyleSheet } from 'react-native';
import { INK, SPACE, metalGradient } from '../../lib/theme';
import { ORNAMENTS } from '../../lib/ornaments';
import { useActiveFestival } from '../../lib/festivals';

interface Props {
  tint?: string;
  /** False runs the rule straight across: the header's rule, where a knot doubled the screen's ornament. */
  knot?: boolean;
}

export function SectionDivider({ tint = INK.muted, knot = true }: Props) {
  const [bright] = metalGradient(tint);
  const festival = useActiveFestival();
  const knotTint = festival ? { tintColor: festival.color } : undefined;
  if (!knot) {
    // Without a knot to carry it, a festival's colour goes to the rule itself.
    return (
      <View style={styles.row}>
        <Image source={ORNAMENTS.rule} resizeMode="stretch" style={[styles.line, { tintColor: festival?.color ?? bright }]} />
        <Image source={ORNAMENTS.rule} resizeMode="stretch" style={[styles.line, styles.mirrored, styles.joined, { tintColor: festival?.color ?? bright }]} />
      </View>
    );
  }
  return (
    <View style={styles.row}>
      {/* One brushed rule each side, swelling from a hair at the margin to full at the knot — the
          glyphs' brush rather than a gradient bar (2026-10-03). Tinted, so the metal still carries. */}
      <Image source={ORNAMENTS.rule} resizeMode="stretch" style={[styles.line, { tintColor: bright }]} />
      <Image source={ORNAMENTS.knotGold} testID="ulzii-divider-knot" style={[styles.knot, knotTint]} />
      <Image source={ORNAMENTS.rule} resizeMode="stretch" style={[styles.line, styles.mirrored, { tintColor: bright }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginVertical: SPACE.sm },
  line: { flex: 1, height: 4, opacity: 0.85 },
  mirrored: { transform: [{ scaleX: -1 }] },
  knot: { width: 15, height: 15, opacity: 0.9 },
  // The two halves meet at full weight in the middle, with no gap where the knot stood.
  joined: { marginLeft: -SPACE.sm },
});
