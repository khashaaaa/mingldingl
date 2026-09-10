import { View, Text, StyleSheet } from 'react-native';
import { Icon } from '../ui/Icon';
import { CountText } from '../ui/CountText';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, LINE, RADIUS, SPACE } from '../../lib/theme';
import type { DailyMatchBudget } from '../../hooks/useScore';

// Stands in for the remaining count inside the translated sentence, so the sentence keeps its
// own word order in every language and only the number is swapped for a counting one.
const SLOT = '\uFFFC';

interface Props {
  budget: DailyMatchBudget;
}

export function DailyBudgetMeter({ budget }: Props) {
  const spent = budget.remaining <= 0;
  const [before, after] = i18n.t('daily_budget_left', { remaining: SLOT, budget: budget.budget }).split(SLOT);
  return (
    <View style={[styles.wrap, spent && styles.wrapSpent]} accessibilityRole="text" testID="daily-budget-meter">
      <Icon name={spent ? 'moon-waning-crescent' : 'fire'} size={ICON_SIZES.sm} color={spent ? COLORS.textDim : COLORS.gold} />
      <Text style={[styles.text, spent && styles.textSpent]} numberOfLines={1}>
        {spent
          ? i18n.t('daily_budget_spent')
          : <>{before}<CountText value={budget.remaining} />{after}</>}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    alignSelf: 'center',
    marginBottom: SPACE.sm,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.xs,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.brass,
    backgroundColor: COLORS.panel,
  },
  wrapSpent: { borderColor: LINE.edge },
  text: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.sm, color: COLORS.gold, letterSpacing: 0.5 },
  textSpent: { color: COLORS.textDim },
});
