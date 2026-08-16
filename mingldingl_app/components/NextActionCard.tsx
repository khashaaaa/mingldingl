import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AppCard } from './ui/AppCard';
import { QuestBanner } from './quest/QuestBanner';
import { useNextAction } from '../hooks/useNextAction';
import { i18n } from '../lib/i18n';
import { COLORS, FONTS } from '../lib/theme';

// Collapses the score/tier/reputation/membership/quest stack into one
// tappable prompt, so the character sheet leads with "what do I do now"
// instead of asking the reader to reconcile five stat panels at once.
export function NextActionCard() {
  const action = useNextAction();
  const router = useRouter();
  if (!action) return null;

  let icon = '';
  let title = '';
  let onPress: (() => void) | null = null;

  switch (action.kind) {
    case 'finish_profile':
      icon = '📝';
      title = i18n.t('next_action_finish_profile');
      onPress = () => router.push('/edit-profile');
      break;
    case 'icebreaker':
      icon = '🎯';
      title = i18n.t('next_action_icebreaker', { name: action.name });
      onPress = () => router.push(`/icebreaker/${action.matchId}`);
      break;
    case 'claim_chest':
      icon = '🎁';
      title = i18n.t('next_action_claim_chest');
      onPress = () => router.push('/(tabs)/activity');
      break;
    case 'quest_progress':
      icon = '🗺️';
      title = i18n.t('next_action_quest_progress', { progress: action.progress, target: action.target });
      onPress = () => router.push('/(tabs)/activity');
      break;
    case 'streak':
      icon = '🔥';
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
          <Text style={styles.staticIcon}>{icon}</Text>
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
