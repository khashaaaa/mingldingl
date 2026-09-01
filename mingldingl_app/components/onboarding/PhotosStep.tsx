import { useState } from 'react';
import { YStack, XStack, Text, Input } from 'tamagui';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS } from '../../lib/theme';
import { PhotoGrid } from '../PhotoGrid';
import { StepScaffold } from './StepScaffold';
import { GameButton } from '../ui/GameButton';

interface Props {
  photoUrls: string[];
  onPhotosChange: (update: string[] | ((current: string[]) => string[])) => void;
  referralCode: string;
  onReferralCodeChange: (code: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PhotosStep({ photoUrls, onPhotosChange, referralCode, onReferralCodeChange, onNext, onBack }: Props) {
  const [photosUploading, setPhotosUploading] = useState(false);
  return (
    <StepScaffold>
      <YStack flex={1} padding="$6" gap="$4">
      <Text color={COLORS.text} fontSize={22} fontFamily={FONTS.display as any}>{i18n.t('your_photos')}</Text>
      <Text color={COLORS.textDim} fontSize={14} fontFamily={FONTS.body as any}>{i18n.t('add_photos_hint')}</Text>
      <PhotoGrid photoUrls={photoUrls} onChange={onPhotosChange} onUploadingChange={setPhotosUploading} />
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
        placeholderTextColor={COLORS.textDim as any}
      />
      <XStack gap="$3" marginTop="auto">
        <GameButton variant="ghost" flex={1} onPress={onBack}>
          {i18n.t('back')}
        </GameButton>
        <GameButton
          variant="primary" flex={2}
          disabled={photoUrls.length < 3 || photosUploading}
          loading={photosUploading}
          onPress={onNext}
        >
          {i18n.t('next')}
        </GameButton>
      </XStack>
      </YStack>
    </StepScaffold>
  );
}
