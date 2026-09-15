import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AppCard } from './ui/AppCard';
import { QuestBanner } from './quest/QuestBanner';
import { CardEyebrow } from './ui/CardEyebrow';
import { Icon } from './ui/Icon';
import { useNextAction } from '../hooks/useNextAction';
import { i18n } from '../lib/i18n';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, SPACE } from '../lib/theme';
export function NextActionCard() {
  const action = useNextAction();
  const router = useRouter();
  if (!action) return null;

  let icon: React.ComponentProps<typeof QuestBanner>['icon'] = 'star-four-points';
  let title = '';
  let onPress: (() => void) | null = null;

  switch (action.kind) {
    case 'finish_profile':
      icon = 'account-edit';
      title = i18n.t('next_action_finish_profile');
      onPress = () => router.push('/edit-profile');
      break;
    case 'icebreaker':
      icon = 'target';
      title = i18n.t('next_action_icebreaker', { name: action.name });
      onPress = () => router.push(`/icebreaker/${action.matchId}`);
      break;
    case 'claim_chest':
      icon = 'gift';
      title = i18n.t('next_action_claim_chest');
      onPress = () => router.push('/(tabs)/activity');
      break;
    case 'quest_progress':
      icon = 'map';
      title = i18n.t('next_action_quest_progress', { progress: action.progress, target: action.target });
      onPress = () => router.push('/(tabs)/activity');
      break;
    case 'streak':
      icon = 'fire';
      title = i18n.t('next_action_streak', { days: action.days });
      break;
  }

  return (
    <AppCard hero style={styles.card}>
      <CardEyebrow>{i18n.t('next_action_heading')}</CardEyebrow>
      {onPress ? (
        // The card already pads its contents; the banner's own side margin (meant for the chat,
        // where it sits on the bare page) pushed it in past the "What's next" label above.
        <QuestBanner icon={icon} title={title} onPress={onPress} style={styles.banner} />
      ) : (
        <View style={styles.staticRow}>
          <Icon name={icon} size={ICON_SIZES.md} color={ACCENT.base} />
          <Text style={styles.staticTitle}>{title}</Text>
        </View>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg, padding: SPACE.lg },
  banner: { marginHorizontal: 0 },
  staticRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md, paddingVertical: SPACE.sm, paddingHorizontal: SPACE.xs },
  staticTitle: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: INK.primary },
});
