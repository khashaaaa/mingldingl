import { View, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, INK, SPACE, metalGradient } from '../../lib/theme';
import { ORNAMENTS } from '../../lib/ornaments';
import { useActiveFestival } from '../../lib/festivals';

interface Props { tint?: string; }

export function SectionDivider({ tint = INK.muted }: Props) {
  const [bright, , dark] = metalGradient(tint);
  const festival = useActiveFestival();
  const knotTint = festival ? { tintColor: festival.color } : undefined;
  return (
    <View style={styles.row}>
      <LinearGradient colors={[dark, bright]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
      <Image source={ORNAMENTS.knotGold} testID="ulzii-divider-knot" style={[styles.knot, knotTint]} />
      <LinearGradient colors={[bright, dark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm, marginVertical: SPACE.sm },
  line: { flex: 1, height: 1.5, opacity: 0.85 },
  knot: { width: 15, height: 15, opacity: 0.9 },
});
