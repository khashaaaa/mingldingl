import { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { GameButton } from '../ui/GameButton';
import { CharacterCard } from './CharacterCard';
import { i18n } from '../../lib/i18n';
import type { GemTier } from '../../models/user';

interface Props {
  displayName: string;
  photoUrl?: string;
  gemTier: GemTier;
  totalScore: number;
  currentStreak: number;
}

// Renders the shareable card off-screen (still mounted/laid out, just outside
// the visible viewport — react-native-view-shot needs real layout to capture,
// display:none/opacity:0 views often capture blank) and pushes the result
// through the OS share sheet on tap.
export function ShareCharacterButton({ displayName, photoUrl, gemTier, totalScore, currentStreak }: Props) {
  const shotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const uri = await shotRef.current?.capture?.();
      if (uri && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(uri);
      }
    } catch {
      // Capture/share failed or the user cancelled the share sheet — nothing
      // to recover, just stop spinning.
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <GameButton variant="brass" size="compact" icon="share-variant" loading={sharing} onPress={handleShare}>
        {i18n.t('share_character')}
      </GameButton>
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
});
