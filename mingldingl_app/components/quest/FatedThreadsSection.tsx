import { View, Text, StyleSheet } from 'react-native';
import { usePendingShips } from '../../hooks/usePendingShips';
import { i18n } from '../../lib/i18n';
import { LEADING, ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, SPACE } from '../../lib/theme';
import { AppCard } from '../ui/AppCard';
import { CardEyebrow } from '../ui/CardEyebrow';
import { GameButton } from '../ui/GameButton';
import { Icon } from '../ui/Icon';

/**
 * Both answers are ink. This section renders on the Quest Log (`app/(tabs)/activity.tsx`), whose
 * forge belongs to `QuestBoard`'s chest claim — a primary "Find Out" here would put a second slab
 * on the same screen. The accept carries the thread's own mark so it still reads as the answer
 * the prompt is asking for, without borrowing the forge to say so.
 */
export function FatedThreadsSection() {
  const { pendingShips, respond } = usePendingShips();

  if (pendingShips.length === 0) return null;

  return (
    <View style={styles.section}>
      <CardEyebrow color={ACCENT.base}>{i18n.t('fated_threads_title')}</CardEyebrow>
      {pendingShips.map((ship) => (
        <AppCard key={ship.shipId} style={styles.card}>
          <Icon name="bow-arrow" size={ICON_SIZES.lg} color={ACCENT.base} />
          <Text style={styles.message}>
            {i18n.t('ship_prompt_message', { weaver: ship.weaverDisplayName })}
          </Text>
          <View style={styles.actions}>
            <GameButton
              variant="ink"
              flex={1}
              onPress={() => respond({ shipId: ship.shipId, accept: false })}
            >
              {i18n.t('ship_pass')}
            </GameButton>
            <GameButton
              variant="ink"
              icon="bow-arrow"
              flex={1}
              onPress={() => respond({ shipId: ship.shipId, accept: true })}
            >
              {i18n.t('ship_accept')}
            </GameButton>
          </View>
        </AppCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: SPACE.md, marginBottom: SPACE.lg },
  card: { padding: SPACE.lg, gap: SPACE.md },
  message: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.primary, lineHeight: LEADING.md },
  actions: { flexDirection: 'row', gap: SPACE.md },
});
