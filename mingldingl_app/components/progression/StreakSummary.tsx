import { View, Text, StyleSheet } from 'react-native';
import { CardEyebrow } from '../ui/CardEyebrow';
import { i18n } from '../../lib/i18n';
import { AppCard } from '../ui/AppCard';
import { COLORS, FONTS, FONT_SIZES, SPACE } from '../../lib/theme';

interface Props {
  currentStreak: number;
  longestStreak: number;
}

export function StreakSummary({ currentStreak, longestStreak }: Props) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.row}>
        <View style={styles.stat}>
          <CardEyebrow>{i18n.t('streak_current')}</CardEyebrow>
          <Text style={styles.value}>{currentStreak}</Text>
        </View>
        <View style={styles.stat}>
          <CardEyebrow>{i18n.t('streak_longest')}</CardEyebrow>
          <Text style={styles.value}>{longestStreak}</Text>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACE.lg, marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg },
  row: { flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center' },
  value: { fontSize: FONT_SIZES.title, fontFamily: FONTS.displayBlack, color: COLORS.gold },
});
