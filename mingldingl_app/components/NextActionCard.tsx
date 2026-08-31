import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AppCard } from './ui/AppCard';
import { QuestBanner } from './quest/QuestBanner';
import { Icon } from './ui/Icon';
import { useNextAction } from '../hooks/useNextAction';
import { i18n } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

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
    <AppCard style={styles.card}>
      <Text style={styles.heading}>{i18n.t('next_action_heading').toUpperCase()}</Text>
      {onPress ? (
        <QuestBanner icon={icon} title={title} onPress={onPress} />
      ) : (
        <View style={styles.staticRow}>
          <Icon name={icon} size={16} color={COLORS.gold} />
          <Text style={styles.staticTitle}>{title}</Text>
        </View>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 16, padding: 16 },
  heading: { fontFamily: FONTS.display, fontSize: 10, color: COLORS.textDim, letterSpacing: 2, marginBottom: 4 },
  staticRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 4 },
  staticIcon: { fontSize: 18 },
  staticTitle: { flex: 1, fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.text },
});
