import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { Icon } from '../ui/Icon';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, SPACE } from '../../lib/theme';

interface Props {
  isProfileComplete: boolean;
  // Achieved milestone ids from GET /engagement/milestones (achievedAt set) —
  // only 'first_match' | 'first_icebreaker' | 'first_quiz' are read here.
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
        size={20}
        color={step.done ? COLORS.gold : COLORS.textDim}
      />
      <Text style={[styles.label, step.done && styles.labelDone]}>{i18n.t(step.labelKey)}</Text>
    </View>
  );
  if (!step.onPress) return row;
  return <TouchableOpacity onPress={step.onPress}>{row}</TouchableOpacity>;
}

// A new user's first async match can take a while to land — this makes the
// pre-match funnel (profile → match → icebreaker → quiz) explicit instead of
// leaving it to be discovered through the daily quest board, which rotates
// and may not even include icebreaker/quiz on a given day (see
// QuestService.QuestsForDate). Self-hides once every step is done, the same
// way InviteAllyCard hides once there's nothing left to show.
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

  if (steps.every((s) => s.done)) return null;

  return (
    <AppCard style={styles.card}>
      <Text style={styles.heading}>{i18n.t('getting_started_title').toUpperCase()}</Text>
      {steps.map((step) => <StepRow key={step.key} step={step} />)}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 16, padding: 16, gap: SPACE.sm },
  heading: { fontFamily: FONTS.display, fontSize: 10, color: COLORS.textDim, letterSpacing: 2, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  label: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.text },
  labelDone: { color: COLORS.textDim, textDecorationLine: 'line-through' },
});
