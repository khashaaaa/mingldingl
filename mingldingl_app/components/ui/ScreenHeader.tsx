import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { COLORS, FONTS } from '../../lib/theme';
import { SectionDivider } from './SectionDivider';

interface Props {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}

export function ScreenHeader({ title, onBack, right }: Props) {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <TouchableOpacity onPress={onBack ?? (() => router.back())} style={styles.backBtn} accessibilityLabel="Go back">
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {right}
      </View>
      <SectionDivider tint={COLORS.gold} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: { padding: 4 },
  backText: { color: COLORS.gold, fontSize: 22, fontFamily: FONTS.bodyMedium },
  title: { flex: 1, color: COLORS.text, fontSize: 24, fontFamily: FONTS.displayBlack, letterSpacing: 1.5 },
});
