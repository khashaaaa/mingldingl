import { YStack, XStack, Text, Input } from 'tamagui';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS } from '../../lib/theme';
import { PhotoGrid } from '../PhotoGrid';
import { GameButton } from '../ui/GameButton';

interface Props {
  photoUrls: string[];
  loading: boolean;
  error?: string | null;
  onPhotosChange: (update: string[] | ((current: string[]) => string[])) => void;
  referralCode: string;
  onReferralCodeChange: (code: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export function PhotosStep({ photoUrls, loading, error, onPhotosChange, referralCode, onReferralCodeChange, onSubmit, onBack }: Props) {
  return (
    <YStack flex={1} padding="$6" gap="$4">
      <Text color={COLORS.text} fontSize={22} fontFamily={FONTS.display as any}>{i18n.t('your_photos')}</Text>
      <Text color={COLORS.textDim} fontSize={14} fontFamily={FONTS.body as any}>{i18n.t('add_photos_hint')}</Text>
      <PhotoGrid photoUrls={photoUrls} onChange={onPhotosChange} />
      <Text color={photoUrls.length >= 3 ? COLORS.goldBright : COLORS.gold} fontSize={13} fontFamily={FONTS.body as any}>
        {i18n.t('photos_minimum', { n: photoUrls.length })}
      </Text>
      <Text color={COLORS.textDim} fontSize={13} fontFamily={FONTS.body as any}>
        {i18n.t('referral_code_field_label')}
      </Text>
      <Input
        placeholder={i18n.t('referral_code_field_placeholder')}
        value={referralCode}
        onChangeText={(text) => onReferralCodeChange(text.toUpperCase())}
        autoCapitalize="characters"
        maxLength={6}
        backgroundColor={COLORS.panel}
        borderColor={COLORS.bronze}
        color={COLORS.text}
      />
      {error && <Text color={COLORS.ember} fontSize={13} fontFamily={FONTS.body as any}>{error}</Text>}
      <XStack gap="$3" marginTop="auto">
        <GameButton variant="ghost" flex={1} onPress={onBack}>
          {i18n.t('back')}
        </GameButton>
        <GameButton
          variant="primary" flex={2}
          disabled={photoUrls.length < 3 || loading}
          loading={loading}
          onPress={onSubmit}
        >
          {i18n.t('complete_profile')}
        </GameButton>
      </XStack>
    </YStack>
  );
}
