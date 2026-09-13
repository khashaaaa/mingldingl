import { useRef, useState } from 'react';
import { Text, View, StyleSheet, useWindowDimensions } from 'react-native';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { GameButton } from '../ui/GameButton';
import { AppModal } from '../modals/AppModal';
import { CharacterCard, CARD_WIDTH, CARD_HEIGHT } from './CharacterCard';
import { i18n } from '../../lib/i18n';
import { FONTS, FONT_SIZES, INK, SCRIM, SPACE, overlay } from '../../lib/theme';
import type { GemTier, Oath } from '../../models/user';

import { FieldError } from '../ui/StateBlock';

interface Props {
  displayName: string;
  photoUrl?: string;
  gemTier: GemTier;
  totalScore: number;
  currentStreak: number;
  oath: Oath | null;
  oathProven: boolean;
}

export function ShareCharacterButton({ displayName, photoUrl, gemTier, totalScore, currentStreak, oath, oathProven }: Props) {
  const shotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // The preview never grows past a comfortable page margin on either side, nor past 70% of the
  // screen's height (room is left for the title and the two buttons beneath it).
  const scale = Math.min((screenWidth - 2 * SPACE.lg) / CARD_WIDTH, (screenHeight * 0.7) / CARD_HEIGHT);

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
      // Closes only on success — a failure leaves the preview open with the error under it, so
      // the person can read what went wrong and try again without re-opening it.
      setPreviewVisible(false);
    } catch {
      setError(i18n.t('share_failed'));
    } finally {
      setSharing(false);
    }
  }

  const cardProps = { displayName, photoUrl, gemTier, totalScore, currentStreak, oath, oathProven };

  return (
    <>
      <GameButton variant="ink" size="compact" icon="share-variant" onPress={() => setPreviewVisible(true)}>
        {i18n.t('share_character')}
      </GameButton>
      {/* The capture source. It stays mounted (and off-screen) regardless of the preview, so the
          preview is always a second render of the exact same props rather than the thing captured. */}
      <View style={styles.offscreen} pointerEvents="none">
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 0.92 }}>
          <CharacterCard {...cardProps} />
        </ViewShot>
      </View>

      {previewVisible && (
        <AppModal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewVisible(false)}
        >
          <View style={styles.scrim}>
            <Text style={styles.title}>{i18n.t('keepsake_preview')}</Text>
            <View style={{ width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale }}>
              <View style={[styles.previewCard, { transform: [{ scale }] }]}>
                <CharacterCard {...cardProps} />
              </View>
            </View>
            {!!error && <FieldError style={styles.error}>{error}</FieldError>}
            <View style={styles.actions}>
              <GameButton variant="primary" loading={sharing} onPress={handleShare}>
                {i18n.t('post_it')}
              </GameButton>
              <GameButton variant="ink" onPress={() => setPreviewVisible(false)}>
                {i18n.t('keep_it')}
              </GameButton>
            </View>
          </View>
        </AppModal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  offscreen: { position: 'absolute', top: 0, left: -9999 },
  error: { textAlign: 'center' },
  scrim: {
    flex: 1,
    backgroundColor: overlay(SCRIM.ceremony),
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.gutter,
    gap: SPACE.xl,
  },
  title: { fontFamily: FONTS.display, fontSize: FONT_SIZES.title, color: INK.primary },
  // The card is captured at its native 360x520; scaling the wrapper rather than the card itself
  // keeps `ViewShot`'s own off-screen copy — the thing actually posted — untouched by this math.
  previewCard: { position: 'absolute', top: 0, left: 0, transformOrigin: 'top left' },
  actions: { flexDirection: 'row', gap: SPACE.md },
});
