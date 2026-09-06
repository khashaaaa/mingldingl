import { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GemTierBadge } from '../progression/GemTierBadge';
import { GameButton } from '../ui/GameButton';
import { Icon } from '../ui/Icon';
import OathSigil from '../OathSigil';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, LINE_HEIGHTS, RADIUS, SPACE, overlay, tint } from '../../lib/theme';
import { itemLabel } from '../../lib/tiers';
import type { Candidate } from '../../models/user';

// Clearance the placeholder figure keeps from the photo dots above and the plaque below.
const PLACEHOLDER_INSET = SPACE.xxl;

interface Props {
  candidate: Candidate;
  onRequest: () => void;
  onSkip: () => void;
  requesting?: boolean;
  requestDisabled?: boolean;
}

export function CandidateCard({ candidate, onRequest, onSkip, requesting, requestDisabled }: Props) {
  const photos = candidate.photoUrls ?? [];
  const hasMultiplePhotos = photos.length > 1;

  const [photoIndex, setPhotoIndex] = useState(0);
  useEffect(() => setPhotoIndex(0), [candidate.id]);

  const photo = photos[photoIndex] ?? photos[0];
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = photo && photo !== failedUrl;

  // The info plaque is absolutely positioned over the photo, so the placeholder silhouette has to
  // be told how much room it leaves — a fixed percentage put the figure straight through the name
  // on a short card, and a full-size figure in the sliver that is left just peeks out from behind
  // the photo dots. Measure both and shrink the figure to whatever actually fits, or drop it.
  const [cardHeight, setCardHeight] = useState(0);
  const [infoHeight, setInfoHeight] = useState(0);
  const placeholderIcon = Math.min(
    ICON_SIZES.splash,
    Math.max(0, cardHeight - infoHeight - PLACEHOLDER_INSET * 2),
  );

  // The scrim has to start above the plaque, not at a fixed fraction of the card: a bright photo
  // behind a two-line name and an oath badge left the text sitting on near-white.
  const plaqueTop = cardHeight > 0
    ? Math.max(0.05, Math.min(0.9, 1 - (infoHeight + SPACE.giant) / cardHeight))
    : 0.45;

  function advancePhoto(direction: 1 | -1) {
    setPhotoIndex((i) => (i + direction + photos.length) % photos.length);
  }

  return (
    <View style={styles.card} onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}>
      {showPhoto ? (
        <Image
          source={{ uri: photo }}
          style={styles.photo}
          contentFit="cover"
          onError={() => setFailedUrl(photo)}
        />
      ) : (
        <View style={[styles.photoPlaceholder, { paddingBottom: infoHeight }]}>
          {placeholderIcon >= ICON_SIZES.xl && (
            <Icon name="account" size={placeholderIcon} color={INK.muted} />
          )}
        </View>
      )}

      {hasMultiplePhotos && (
        <>
          <View style={styles.photoDots}>
            {photos.map((_, i) => (
              <View key={i} style={[styles.photoDot, i === photoIndex && styles.photoDotActive]} />
            ))}
          </View>
          <Pressable
            style={styles.photoTapLeft}
            onPress={() => advancePhoto(-1)}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('previous_photo')}
          />
          <Pressable
            style={styles.photoTapRight}
            onPress={() => advancePhoto(1)}
            accessibilityRole="button"
            accessibilityLabel={i18n.t('next_photo')}
          />
        </>
      )}

      <LinearGradient
        colors={['transparent', overlay(0.72), overlay(0.97)]}
        style={StyleSheet.absoluteFill}
        locations={[Math.max(0, plaqueTop - 0.18), plaqueTop, 1]}
        pointerEvents="none"
      />

      <View style={styles.info} onLayout={(e) => setInfoHeight(e.nativeEvent.layout.height)}>
        <View style={styles.plaqueRule} />
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{candidate.displayName}, {candidate.age}</Text>
          <GemTierBadge tier={candidate.gemTier} size={32} />
        </View>
        {candidate.equippedTitleId && (
          <Text style={styles.equippedTitle}>{itemLabel(candidate.equippedTitleId)}</Text>
        )}
        <OathSigil oath={candidate.oath} proven={candidate.oathProven} size="sm" />
        {candidate.city && (
          <View style={styles.locationRow}>
            <Icon name="map-marker" size={ICON_SIZES.sm} color={COLORS.textDim} />
            <Text style={styles.location}>{candidate.city}</Text>
          </View>
        )}
        {candidate.bio ? (
          <Text style={styles.bio} numberOfLines={2}>{candidate.bio}</Text>
        ) : null}

        <View style={styles.actions}>
          <GameButton variant="ghost" flex={1} disabled={requesting} onPress={onSkip}>{i18n.t('skip')}</GameButton>
          <GameButton variant="primary" flex={1.5} loading={requesting} disabled={requestDisabled} onPress={onRequest}>{i18n.t('send_summons')}</GameButton>
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
    borderColor: LINE.edge,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  photo: { ...StyleSheet.absoluteFillObject },
  photoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoDots: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: SPACE.xs,
  },
  photoDot: { flex: 1, height: 3, borderRadius: RADIUS.pill, backgroundColor: tint(COLORS.text, 0.3) },
  photoDotActive: { backgroundColor: COLORS.gold },
  photoTapLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '35%' },
  photoTapRight: { position: 'absolute', top: 0, bottom: 0, right: 0, width: '65%' },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACE.xxl,
    gap: SPACE.sm,
  },
  plaqueRule: { height: 1, backgroundColor: tint(COLORS.gold, 0.5), marginBottom: SPACE.xs },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: FONT_SIZES.display,
    fontFamily: FONTS.display,
    color: COLORS.text,
    letterSpacing: 0.3,
    flex: 1,
  },
  equippedTitle: { fontSize: FONT_SIZES.sm, fontFamily: FONTS.utility, color: COLORS.gold, letterSpacing: 1 },
  location: { fontSize: FONT_SIZES.md, fontFamily: FONTS.body, color: COLORS.textDim },
  bio: { fontSize: FONT_SIZES.lg, fontFamily: FONTS.body, color: COLORS.text, lineHeight: LINE_HEIGHTS.lg },
  actions: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.sm },
});
