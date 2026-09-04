import { Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { CardEyebrow } from '../ui/CardEyebrow';
import { AppCard } from '../ui/AppCard';
import { Icon } from '../ui/Icon';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, SPACE } from '../../lib/theme';

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

  if (steps.every((s) => s.done)) return null;

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
});
