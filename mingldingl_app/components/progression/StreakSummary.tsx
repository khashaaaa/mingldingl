import { View, Text, StyleSheet } from 'react-native';
import { CardEyebrow } from '../ui/CardEyebrow';
import { Lantern } from './Lantern';
import { i18n } from '../../lib/i18n';
import { AppCard } from '../ui/AppCard';
import { COLORS, FONTS, FONT_SIZES, LINE, SPACE } from '../../lib/theme';

interface Props {
  currentStreak: number;
  longestStreak: number;
}

export function StreakSummary({ currentStreak, longestStreak }: Props) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.current}>
        <CardEyebrow>{i18n.t('streak_current')}</CardEyebrow>
        <Lantern days={currentStreak} />
      </View>
      <View style={styles.longest}>
        <CardEyebrow style={styles.longestLabel}>{i18n.t('streak_longest')}</CardEyebrow>
        <Text style={styles.value}>{longestStreak}</Text>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: SPACE.lg, marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg },
  current: { alignItems: 'center' },
  longest: {
    marginTop: SPACE.md,
    paddingTop: SPACE.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: LINE.hairline,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  longestLabel: { marginBottom: 0 },
  value: { fontSize: FONT_SIZES.title, fontFamily: FONTS.displayBlack, color: COLORS.gold },
});
