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

// Below `GettingStartedCard`, this card's `flex: 1` can be squeezed to a sliver — the info plaque
// (name/bio/actions) stays roughly the same height regardless, so a short card reads as mostly
// plaque and the photo crops to a forehead. A floor on the card's own aspect ratio (not on the
// plaque's share of it, which scales with bio length and is unpredictable) keeps the card tall
// enough, relative to its own width, for the photo to still read as a portrait — see
// task-8-brief.md. 4:3 is a conservative portrait ratio, not the tightest one, on purpose: it's
// the minimum that still has to coexist with the getting-started board above it.
const MIN_PHOTO_ASPECT = 4 / 3;

interface Props {
  candidate: Candidate;
  onRequest: () => void;
  onSkip: () => void;
  requesting?: boolean;
  requestDisabled?: boolean;
  // `discover.tsx`'s measured `cardArea` height — this screen has no scroll view, so it is the
  // hard ceiling on how tall this card is ever allowed to ask to be. Without it, the aspect-ratio
  // floor above can demand more height than the screen actually has, pushing the action row (Skip
  // / Send Summons) off the bottom on a short device — see task-8-report.md's "clamp" addendum.
  availableHeight?: number;
}

export function CandidateCard({ candidate, onRequest, onSkip, requesting, requestDisabled, availableHeight }: Props) {
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
  const [cardWidth, setCardWidth] = useState(0);
  const [infoHeight, setInfoHeight] = useState(0);
  // Measured, not a hardcoded constant: the Mongolian labels for "Skip"/"Send Summons" run longer
  // than the English ones and can wrap the row to a second line, and a literal here would silently
  // stop matching the moment either button's size changes.
  const [actionsHeight, setActionsHeight] = useState(0);
  const placeholderIcon = Math.min(
    ICON_SIZES.splash,
    Math.max(0, cardHeight - infoHeight - PLACEHOLDER_INSET * 2),
  );

  // The floor above is an *ideal* — it must never win against `availableHeight` (`cardArea`'s own
  // measured box; this screen has no scroll, so that box is a hard ceiling) minus room for the
  // action row plus its own top margin. `availableHeight` comes from the parent, not from this
  // card's own `cardHeight` state, deliberately: `cardHeight` is fed by this same onLayout and
  // would move if `minHeight` ever changed it, which is exactly the self-referential growth this
  // clamp exists to rule out.
  const reservedForActions = actionsHeight > 0 ? actionsHeight + SPACE.sm : 0;
  // `discover.tsx`'s `cardArea` (the parent `availableHeight` is measured on) carries its own
  // `paddingBottom: SPACE.lg`, which isn't part of this card's own box.
  const availableForCard = availableHeight && availableHeight > 0
    ? Math.max(0, availableHeight - SPACE.lg)
    : 0;
  const idealPhotoFloor = cardWidth > 0 ? cardWidth * MIN_PHOTO_ASPECT : 0;
  const minCardHeight = idealPhotoFloor > 0 && availableForCard > 0
    ? Math.max(0, Math.min(idealPhotoFloor, availableForCard - reservedForActions))
    : 0;

  // The scrim has to start above the plaque, not at a fixed fraction of the card: a bright photo
  // behind a two-line name and an oath badge left the text sitting on near-white.
  const plaqueTop = cardHeight > 0
    ? Math.max(0.05, Math.min(0.9, 1 - (infoHeight + SPACE.giant) / cardHeight))
    : 0.45;

  function advancePhoto(direction: 1 | -1) {
    setPhotoIndex((i) => (i + direction + photos.length) % photos.length);
  }

  return (
    <View
      testID="candidate-card"
      style={[styles.card, minCardHeight > 0 && { minHeight: minCardHeight }]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setCardHeight(height);
        setCardWidth(width);
      }}
    >
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
          {/* The dots sit directly on the photograph, and an inactive one was COLORS.text at 30%
              alpha — 1.01:1 against a pale background, i.e. gone. Two changes, because the scrim
              alone made it worse: a translucent dot darkens along with the ground it is drawn on,
              so the dot is opaque now and the scrim gives it a ground it can rely on. Worst case
              (a white-wall portrait) lands at 3.5:1 instead of 1.01:1. */}
          <LinearGradient
            colors={[overlay(0.75), 'transparent']}
            style={styles.photoDotsScrim}
            pointerEvents="none"
          />
          <View style={styles.photoDots}>
            {photos.map((_, i) => (
              <View
                key={i}
                testID={i === photoIndex ? 'photo-dot-active' : 'photo-dot-inactive'}
                style={[styles.photoDot, i === photoIndex && styles.photoDotActive]}
              />
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

        <View
          testID="candidate-actions"
          style={styles.actions}
          onLayout={(e) => setActionsHeight(e.nativeEvent.layout.height)}
        >
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
  photoDotsScrim: { position: 'absolute', top: 0, left: 0, right: 0, height: 72 },
  photoDots: {
    position: 'absolute',
    top: 12,
    left: 16,
    right: 16,
    flexDirection: 'row',
    gap: SPACE.xs,
  },
  photoDot: { flex: 1, height: 3, borderRadius: RADIUS.pill, backgroundColor: COLORS.textDim },
  // COLORS.gold measured at ~3.05:1 against the scrim's own worst case — barely past the 3:1
  // floor and, backwards, *less* legible than the inactive dots' 3.1:1 (see the comment above).
  // goldBright clears the same worst case at ~4.6:1.
  photoDotActive: { backgroundColor: COLORS.goldBright },
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
