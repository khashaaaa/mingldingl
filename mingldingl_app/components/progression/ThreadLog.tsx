import { View, Text, StyleSheet } from 'react-native';
import { CardEyebrow } from '../ui/CardEyebrow';
import { AppCard } from '../ui/AppCard';
import { i18n } from '../../lib/i18n';
import { itemLabel } from '../../lib/tiers';
import { COLORS, FONTS, FONT_SIZES, SPACE } from '../../lib/theme';

const MILESTONE_TITLE_IDS = ['title_threadweaver', 'title_fateseer', 'title_bondkeeper'] as const;

interface Props {
  ownedItemIds: string[];
}

export function ThreadLog({ ownedItemIds }: Props) {
  const earned = MILESTONE_TITLE_IDS.filter((id) => ownedItemIds.includes(id));

  return (
    <AppCard style={styles.card}>
      <CardEyebrow>{i18n.t('thread_log_title')}</CardEyebrow>
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
  card: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg, padding: SPACE.lg, gap: SPACE.md },
  empty: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim },
  list: { gap: SPACE.sm },
  titleRow: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: COLORS.gold },
});
