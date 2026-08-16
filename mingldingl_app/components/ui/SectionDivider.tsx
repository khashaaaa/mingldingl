import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, metalGradient } from '../../lib/theme';

interface Props { tint?: string; }

// A metal rod, not a flat rule: each half fades from the tint's bright
// bevel-stop at the center diamond down to its dark stop at the outer edge,
// so the line reads as struck metal catching light from the middle out —
// same three-stop language as GameButton/ScoreHUD's forged bevel.
export function SectionDivider({ tint = COLORS.bronze }: Props) {
  const [bright, , dark] = metalGradient(tint);
  return (
    <View style={styles.row}>
      <LinearGradient colors={[dark, bright]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
      <Text style={[styles.diamond, { color: bright }]}>◆</Text>
      <LinearGradient colors={[bright, dark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  line: { flex: 1, height: 1.5, opacity: 0.85 },
  diamond: { fontSize: 10 },
});
