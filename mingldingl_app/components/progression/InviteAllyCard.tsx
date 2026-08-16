import { Share, StyleSheet } from 'react-native';
import { AppCard } from '../ui/AppCard';
import { GameButton } from '../ui/GameButton';
import { Text, View } from 'react-native';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, SPACE } from '../../lib/theme';

interface Props {
  referralCode: string | null | undefined;
}

export function InviteAllyCard({ referralCode }: Props) {
  if (!referralCode) return null;

  function handleShare() {
    // Assigned to an explicitly-typed local rather than inlined: Share's
    // ShareContent is a discriminated union ({message: string, url?} |
    // {message?: string, url: string}), and feeding i18n.t()'s generic
    // return type (`string | T`, T defaulting to string) straight into that
    // union's contextual type makes TS infer T as undefined, widening the
    // result to `string | undefined`. Pinning the type here first avoids that.
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
  card: { marginHorizontal: 20, marginBottom: 16, padding: 16, gap: SPACE.sm },
  title: { fontFamily: FONTS.display, fontSize: 16, color: COLORS.gold, letterSpacing: 1 },
  hint: { fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim },
  codeRow: { alignItems: 'center', paddingVertical: SPACE.sm },
  code: { fontFamily: FONTS.displayBlack, fontSize: 28, color: COLORS.text, letterSpacing: 4 },
});
