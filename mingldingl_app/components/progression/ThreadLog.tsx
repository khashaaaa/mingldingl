import { View, Text, StyleSheet } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { i18n } from '../../lib/i18n';
import { itemLabel } from '../../lib/tiers';
import { COLORS, FONTS } from '../../lib/theme';

const MILESTONE_TITLE_IDS = ['title_threadweaver', 'title_fateseer', 'title_bondkeeper'] as const;

interface Props {
  ownedItemIds: string[];
}

export function ThreadLog({ ownedItemIds }: Props) {
  const earned = MILESTONE_TITLE_IDS.filter((id) => ownedItemIds.includes(id));

  return (
    <AppCard style={styles.card}>
      <Text style={styles.heading}>{i18n.t('thread_log_title').toUpperCase()}</Text>
      {earned.length === 0 ? (
        <Text style={styles.empty}>{i18n.t('thread_log_empty')}</Text>
      ) : (
        <View style={styles.list}>
          {earned.map((id) => (
            <Text key={id} style={styles.titleRow}>{itemLabel(id)}</Text>
          ))}
        </View>
      )}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 20, marginBottom: 16, padding: 16, gap: 10 },
  heading: { fontFamily: FONTS.display, fontSize: 10, color: COLORS.textDim, letterSpacing: 2 },
  empty: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim },
  list: { gap: 6 },
  titleRow: { fontFamily: FONTS.bodyMedium, fontSize: 14, color: COLORS.gold },
});
