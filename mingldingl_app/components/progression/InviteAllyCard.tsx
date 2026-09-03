import { Share, StyleSheet } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { GameButton } from '../ui/GameButton';
import { Text, View } from 'react-native';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, SPACE } from '../../lib/theme';

interface Props {
  referralCode: string | null | undefined;
}

export function InviteAllyCard({ referralCode }: Props) {
  if (!referralCode) return null;

  function handleShare() {
    const message: string = i18n.t('referral_share_message', { code: referralCode });
    Share.share({ message });
  }

  return (
    <AppCard style={styles.card}>
      <Text style={styles.title}>{i18n.t('invite_ally_title')}</Text>
      <Text style={styles.hint}>{i18n.t('invite_ally_hint')}</Text>
      <View style={styles.codeRow}>
        <Text style={styles.code}>{referralCode}</Text>
      </View>
      <GameButton variant="ghost" icon="share-variant" onPress={handleShare}>
        {i18n.t('invite_ally_title')}
      </GameButton>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: SPACE.gutter, marginBottom: SPACE.lg, padding: SPACE.lg, gap: SPACE.sm },
  title: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: COLORS.gold, letterSpacing: 1 },
  hint: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: COLORS.textDim },
  codeRow: { alignItems: 'center', paddingVertical: SPACE.sm },
  code: { fontFamily: FONTS.displayBlack, fontSize: FONT_SIZES.display, color: COLORS.text, letterSpacing: 4 },
});
