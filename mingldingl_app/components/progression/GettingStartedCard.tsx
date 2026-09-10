import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { CardEyebrow } from '../ui/CardEyebrow';
import { AppCard } from '../ui/AppCard';
import { Icon } from '../ui/Icon';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, LINE, RADIUS, SPACE } from '../../lib/theme';

interface Props {
  isProfileComplete: boolean;

  achievedMilestoneIds: string[];
  onCompleteProfile: () => void;
}

interface Step {
  key: string;
  labelKey: string;
  done: boolean;
  onPress?: () => void;
}

function StepRow({ step }: { step: Step }) {
  const row = (
    <View style={styles.row}>
      <Icon
        name={step.done ? 'check-circle' : 'circle-outline'}
        size={ICON_SIZES.lg}
        color={step.done ? COLORS.gold : COLORS.textDim}
      />
      <Text style={[styles.label, step.done && styles.labelDone]}>{i18n.t(step.labelKey)}</Text>
    </View>
  );
  if (!step.onPress) return row;
  return <TouchableOpacity onPress={step.onPress}>{row}</TouchableOpacity>;
}

export function GettingStartedCard({ isProfileComplete, achievedMilestoneIds, onCompleteProfile }: Props) {
  const steps: Step[] = [
    {
      key: 'profile',
      labelKey: 'getting_started_profile',
      done: isProfileComplete,
      onPress: isProfileComplete ? undefined : onCompleteProfile,
    },
    { key: 'match', labelKey: 'getting_started_match', done: achievedMilestoneIds.includes('first_match') },
    { key: 'icebreaker', labelKey: 'getting_started_icebreaker', done: achievedMilestoneIds.includes('first_icebreaker') },
    { key: 'quiz', labelKey: 'getting_started_quiz', done: achievedMilestoneIds.includes('first_quiz') },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  // Once any step is done, the board has made its point, and its full four-row form is what was
  // squeezing the discover card's photo band on first run (task-8) — collapse to a one-line
  // progress summary from the first completed step onward, reclaiming the column exactly when the
  // guidance has started to land. A user who has completed nothing stays on the full board on
  // purpose: they need the guidance more than they need the room back (task-8-report.md).
  if (doneCount > 0) {
    return (
      <View style={styles.compactCard} testID="getting-started-compact">
        <Icon name="check-circle" size={ICON_SIZES.sm} color={COLORS.gold} />
        <CardEyebrow style={styles.compactLabel}>{i18n.t('getting_started_title')}</CardEyebrow>
        {/* Reuses the existing "%{held} of %{needed}" key rather than adding a new one — it
            already carries a Mongolian translation with the word order that language needs.
            Its other call site is HonourCase.tsx's trophy progress — the key is named for
            honours, so a honours-specific copy edit there would silently retext this board too. */}
        <Text style={styles.compactProgress}>
          {i18n.t('honour_progress', { held: doneCount, needed: steps.length })}
        </Text>
      </View>
    );
  }

  return (
    <AppCard style={styles.card}>
      <CardEyebrow>{i18n.t('getting_started_title')}</CardEyebrow>
      {steps.map((step) => <StepRow key={step.key} step={step} />)}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg, padding: SPACE.lg, gap: SPACE.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm },
  label: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.text },
  labelDone: { color: COLORS.textDim, textDecorationLine: 'line-through' },
  compactCard: {
    marginHorizontal: SPACE.gutter,
    marginBottom: SPACE.lg,
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.sm,
    backgroundColor: COLORS.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: LINE.edge,
  },
  compactLabel: { flex: 1, marginBottom: 0 },
  compactProgress: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.sm, color: COLORS.gold },
});
