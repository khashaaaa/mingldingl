import { useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { GameButton } from '../ui/GameButton';
import { CharacterCard } from './CharacterCard';
import { i18n } from '../../lib/i18n';
import type { GemTier } from '../../models/user';
import { COLORS, FONTS, FONT_SIZES } from '../../lib/theme';

interface Props {
  displayName: string;
  photoUrl?: string;
  gemTier: GemTier;
  totalScore: number;
  currentStreak: number;
}

export function ShareCharacterButton({ displayName, photoUrl, gemTier, totalScore, currentStreak }: Props) {
  const shotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    setError(null);
    try {
      const uri = await shotRef.current?.capture?.();
      if (!uri) {
        setError(i18n.t('share_failed'));
        return;
      }
      if (!(await Sharing.isAvailableAsync())) {
        setError(i18n.t('share_unavailable'));
        return;
      }
      await Sharing.shareAsync(uri);
    } catch {
      setError(i18n.t('share_failed'));
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <GameButton variant="brass" size="compact" icon="share-variant" loading={sharing} onPress={handleShare}>
        {i18n.t('share_character')}
      </GameButton>
      {!!error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.offscreen} pointerEvents="none">
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 0.92 }}>
          <CharacterCard
            displayName={displayName}
            photoUrl={photoUrl}
            gemTier={gemTier}
            totalScore={totalScore}
            currentStreak={currentStreak}
          />
        </ViewShot>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', top: 0, left: -9999 },
  error: { color: COLORS.emberLight, fontFamily: FONTS.body, fontSize: FONT_SIZES.sm, textAlign: 'center' },
});
