import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, SPACE } from '../../lib/theme';
import { PhotoGrid } from '../PhotoGrid';
import { StepScaffold } from './StepScaffold';
import { GameButton } from '../ui/GameButton';
import { TextField } from '../ui/TextField';

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
      <View style={styles.container}>
      <Text style={styles.heading}>{i18n.t('your_photos')}</Text>
      <Text style={styles.hint}>{i18n.t('add_photos_hint')}</Text>
      <PhotoGrid photoUrls={photoUrls} onChange={onPhotosChange} onUploadingChange={setPhotosUploading} />
      <Text style={[styles.count, { color: photoUrls.length >= 3 ? COLORS.goldBright : COLORS.gold }]}>
        {i18n.t('photos_minimum', { n: photoUrls.length })}
      </Text>
      <Text style={styles.label}>
        {i18n.t('referral_code_field_label')}
      </Text>
      <TextField
        placeholder={i18n.t('referral_code_field_placeholder')}
        value={referralCode}
        onChangeText={(text) => onReferralCodeChange(text.toUpperCase())}
        autoCapitalize="characters"
        maxLength={6}
      />
      <View style={styles.actions}>
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
      </View>
      </View>
    </StepScaffold>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: SPACE.huge, gap: SPACE.lg },
  heading: { color: COLORS.text, fontSize: FONT_SIZES.title, fontFamily: FONTS.display },
  hint: { color: COLORS.textDim, fontSize: FONT_SIZES.md, fontFamily: FONTS.body },
  count: { fontSize: FONT_SIZES.sm, fontFamily: FONTS.body },
  label: { color: COLORS.textDim, fontSize: FONT_SIZES.sm, fontFamily: FONTS.body },
  actions: { flexDirection: 'row', gap: SPACE.md, marginTop: 'auto' },
});
