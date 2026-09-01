import { View, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS, metalGradient } from '../../lib/theme';
import { ORNAMENTS } from '../../lib/ornaments';

interface Props { tint?: string; }

export function SectionDivider({ tint = COLORS.bronze }: Props) {
  const [bright, , dark] = metalGradient(tint);
  return (
    <View style={styles.row}>
      <LinearGradient colors={[dark, bright]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
      <Image source={ORNAMENTS.knotGold} testID="ulzii-divider-knot" style={styles.knot} />
      <LinearGradient colors={[bright, dark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 8 },
  line: { flex: 1, height: 1.5, opacity: 0.85 },
  knot: { width: 15, height: 15, opacity: 0.9 },
});
