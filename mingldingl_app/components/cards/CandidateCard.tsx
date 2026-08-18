import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GemTierBadge } from '../progression/GemTierBadge';
import { GameButton } from '../ui/GameButton';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';
import { ITEM_NAME_KEYS } from '../../lib/tiers';
import type { UserProfile } from '../../models/user';

interface Props {
  candidate: UserProfile;
  onRequest: () => void;
  onSkip: () => void;
  requesting?: boolean;
}

export function CandidateCard({ candidate, onRequest, onSkip, requesting }: Props) {
  const photos = candidate.photoUrls ?? [];
  const hasMultiplePhotos = photos.length > 1;

  // CandidateCard is a single persistent instance reused across candidates
  // (no key/remount per swipe) — the index has to reset explicitly whenever
  // the candidate changes, same reason `failedUrl` below tracks a URL
  // rather than a plain boolean.
  const [photoIndex, setPhotoIndex] = useState(0);
  useEffect(() => setPhotoIndex(0), [candidate.id]);

  const photo = photos[photoIndex] ?? photos[0];
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = photo && photo !== failedUrl;

  function advancePhoto(direction: 1 | -1) {
    setPhotoIndex((i) => (i + direction + photos.length) % photos.length);
  }

  return (
    <View style={styles.card}>
      {showPhoto ? (
        <Image
          source={{ uri: photo }}
          style={styles.photo}
          contentFit="cover"
          onError={() => setFailedUrl(photo)}
        />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Text style={styles.photoEmoji}>👤</Text>
        </View>
      )}

      {hasMultiplePhotos && (
        <>
          <View style={styles.photoDots}>
            {photos.map((_, i) => (
              <View key={i} style={[styles.photoDot, i === photoIndex && styles.photoDotActive]} />
            ))}
          </View>
          <Pressable style={styles.photoTapLeft} onPress={() => advancePhoto(-1)} />
          <Pressable style={styles.photoTapRight} onPress={() => advancePhoto(1)} />
        </>
      )}

      <LinearGradient
        colors={['transparent', 'rgba(10,11,16,0.6)', 'rgba(10,11,16,0.97)']}
        style={StyleSheet.absoluteFill}
        locations={[0.35, 0.65, 1]}
        pointerEvents="none"
      />

      <View style={styles.info}>
        <View style={styles.plaqueRule} />
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{candidate.displayName}, {candidate.age}</Text>
          <GemTierBadge tier={candidate.gemTier} size={32} />
        </View>
        {candidate.equippedTitleId && (
          <Text style={styles.equippedTitle}>{i18n.t(ITEM_NAME_KEYS[candidate.equippedTitleId] ?? '')}</Text>
        )}
        {candidate.city && (
          <Text style={styles.location}>📍 {candidate.city}</Text>
        )}
        {candidate.bio ? (
          <Text style={styles.bio} numberOfLines={2}>{candidate.bio}</Text>
        ) : null}

        <View style={styles.actions}>
          {/* 1:2 used to starve Skip of width — fine for "Skip" but the
              Mongolian "Алгасах" (7 letters, no spaces) had nowhere to wrap
              except mid-word. 1:1.5 still keeps Send Summons the visually
              dominant action while giving Skip enough room to fit. */}
          <GameButton variant="ghost" flex={1} disabled={requesting} onPress={onSkip}>{i18n.t('skip')}</GameButton>
          <GameButton variant="primary" flex={1.5} loading={requesting} onPress={onRequest}>{i18n.t('send_summons')}</GameButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.bronze,
  },
  photo: { ...StyleSheet.absoluteFillObject },
  photoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoEmoji: { fontSize: 80 },
  photoDots: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: 4,
  },
  photoDot: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(237,228,211,0.3)' },
  photoDotActive: { backgroundColor: COLORS.gold },
  // Two invisible tap zones over the photo — left third rewinds, right
  // two-thirds advances (mirrors the reading direction more people tap
  // first). Sits behind `info` in paint order so the Skip/Send Summons
  // buttons there still win the touch in their own area.
  photoTapLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '35%' },
  photoTapRight: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '65%' },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
    gap: 8,
  },
  plaqueRule: { height: 1, backgroundColor: 'rgba(217,127,31,0.5)', marginBottom: 4 },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 26,
    fontFamily: FONTS.display,
    color: COLORS.text,
    letterSpacing: 0.3,
    flex: 1,
  },
  equippedTitle: { fontSize: 11, fontFamily: FONTS.display, color: COLORS.gold, letterSpacing: 1 },
  location: { fontSize: 14, fontFamily: FONTS.body, color: COLORS.textDim },
  bio: { fontSize: 15, fontFamily: FONTS.body, color: COLORS.text, lineHeight: 22 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
});
