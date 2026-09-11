import { View, Text, StyleSheet } from 'react-native';
import { CardEyebrow } from '../ui/CardEyebrow';
import { AppCard } from '../ui/AppCard';
import { i18n } from '../../lib/i18n';
import { itemLabel } from '../../lib/tiers';
import { ACCENT, FONTS, FONT_SIZES, SPACE } from '../../lib/theme';
import { EmptyHint } from '../ui/StateBlock';
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
        <EmptyHint>{i18n.t('thread_log_empty')}</EmptyHint>
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
  list: { gap: SPACE.sm },
  titleRow: { fontFamily: FONTS.bodyMedium, fontSize: FONT_SIZES.md, color: ACCENT.base },
});
