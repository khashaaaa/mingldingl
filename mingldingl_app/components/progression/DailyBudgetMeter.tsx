import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../ui/Icon';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';
import type { DailyMatchBudget } from '../../hooks/useScore';

interface Props {
  budget: DailyMatchBudget;
}

export function DailyBudgetMeter({ budget }: Props) {
  const spent = budget.remaining <= 0;
  return (
    <View style={[styles.wrap, spent && styles.wrapSpent]} accessibilityRole="text" testID="daily-budget-meter">
      <Icon name={spent ? 'moon-waning-crescent' : 'fire'} size={13} color={spent ? COLORS.textDim : COLORS.gold} />
      <Text style={[styles.text, spent && styles.textSpent]} numberOfLines={1}>
        {spent
          ? i18n.t('daily_budget_spent')
          : i18n.t('daily_budget_left', { remaining: budget.remaining, budget: budget.budget })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.brass,
    backgroundColor: COLORS.panel,
  },
  wrapSpent: { borderColor: COLORS.bronze },
  text: { fontFamily: FONTS.bodyMedium, fontSize: 12, color: COLORS.gold, letterSpacing: 0.5 },
  textSpent: { color: COLORS.textDim },
});
