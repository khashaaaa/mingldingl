import { View, Text, StyleSheet } from 'react-native';
import { i18n } from '../../lib/i18n';
import { AppCard } from '../ui/AppCard';
import { COLORS, FONTS } from '../../lib/theme';

interface Props {
  currentStreak: number;
  longestStreak: number;
}

export function StreakSummary({ currentStreak, longestStreak }: Props) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.label}>{i18n.t('streak_current')}</Text>
          <Text style={styles.value}>{currentStreak >= 2 ? `🔥${currentStreak}` : currentStreak}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.label}>{i18n.t('streak_longest')}</Text>
          <Text style={styles.value}>{longestStreak}</Text>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginHorizontal: 20, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  label: { fontSize: 10, fontFamily: FONTS.display, color: COLORS.textDim, letterSpacing: 1.5, marginBottom: 6 },
  value: { fontSize: 20, fontFamily: FONTS.displayBlack, color: COLORS.gold },
});
