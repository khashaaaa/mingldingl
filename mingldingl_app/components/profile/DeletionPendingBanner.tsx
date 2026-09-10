import { View, Text, StyleSheet } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { Icon } from '../ui/Icon';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, LINE_HEIGHTS, RADIUS, SPACE } from '../../lib/theme';

interface Props {
  graceDays: number;
  onCancel: () => void;
  isCancelling: boolean;
}

/**
 * A pending deletion is not a quiet setting: MatchEligibility excludes the account from every
 * discovery feed and from the leaderboard, so the whole app goes silent while looking normal.
 * Before this, the only place that state was visible was the Settings screen it was requested
 * from — and since a profile read no longer cancels the request, it now lasts the full grace
 * period. The character sheet is where the character's own fate belongs.
 */
export function DeletionPendingBanner({ graceDays, onCancel, isCancelling }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Icon name="alert-octagon" size={ICON_SIZES.md} color={COLORS.ember} />
        <Text style={styles.title}>{i18n.t('delete_pending_title')}</Text>
      </View>
      <Text style={styles.body}>{i18n.t('delete_pending_body', { days: graceDays })}</Text>
      <Text style={styles.body}>{i18n.t('delete_pending_hidden')}</Text>
      <GameButton variant="primary" size="compact" icon="shield-account" loading={isCancelling} onPress={onCancel}>
        {i18n.t('delete_cancel')}
      </GameButton>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SPACE.gutter,
    marginBottom: SPACE.md,
    padding: SPACE.lg,
    gap: SPACE.sm,
    borderWidth: 1,
    borderColor: COLORS.ember,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.panel,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  title: { flex: 1, color: COLORS.text, fontFamily: FONTS.displayBlack, fontSize: FONT_SIZES.lg },
  body: { color: COLORS.textDim, fontFamily: FONTS.body, fontSize: FONT_SIZES.md, lineHeight: LINE_HEIGHTS.md },
});
