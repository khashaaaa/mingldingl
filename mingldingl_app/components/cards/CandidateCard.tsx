import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GemTierBadge } from '../progression/GemTierBadge';
import { GameButton } from '../ui/GameButton';
import { CardEyebrow } from '../ui/CardEyebrow';
import { SealDots } from '../chat/SealDots';
import { RoomLight } from '../world/RoomLight';
import { oathLabel } from '../OathSigil';
import { i18n } from '../../lib/i18n';
import { ORNAMENTS } from '../../lib/ornaments';
import { LEADING, ACCENT, BADGE_SIZES, FONTS, FONT_SIZES, INK, LINE, RADIUS, SCRIM, SPACE, SURFACE, TEMPERATURE, TRACKING, overlay, tint } from '../../lib/theme';
import { itemLabel, tierLabel } from '../../lib/tiers';
import type { Candidate } from '../../models/user';

/** The wax over the likeness. Matched to `Unsealing`'s seal, one step down for a card. */
const SEAL = 120;

interface Props {
  candidate: Candidate;
  onRequest: () => void;
  onSkip: () => void;
  requesting?: boolean;
  requestDisabled?: boolean;
}

/**
 * A stranger, as the Fire shows them: a likeness under wax, not a photo album.
 *
 * The card used to be a swipe-app gallery — paged photographs, tap targets down both sides, dots
 * along the top — which handed the whole face away before a word was exchanged and left the
 * reveal ladder with nothing to reveal. It is one blurred plate now, sealed, with the three
 * intact seals drawn on it and the law stated once underneath. What is left to decide on is the
 * plaque: name, rank, district, oath, and what they wrote about themselves.
 */
export function CandidateCard({ candidate, onRequest, onSkip, requesting, requestDisabled }: Props) {
  const photo = (candidate.photoUrls ?? [])[0];
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = photo && photo !== failedUrl;

  // The plaque is absolutely positioned over the photo, so both boxes are measured: the seal has
  // to be centred in the room the plaque leaves rather than in the card, and the scrim has to
  // start above the plaque, not at a fixed fraction — a bright photo behind a two-line name left
  // the text sitting on near-white.
  const [cardHeight, setCardHeight] = useState(0);
  const [infoHeight, setInfoHeight] = useState(0);
  const plaqueTop = cardHeight > 0
    ? Math.max(0.05, Math.min(0.9, 1 - (infoHeight + SPACE.giant) / cardHeight))
    : 0.45;

  // One line, in the order the board reads it: rank, then where they are, then what they are here
  // for. The oath was a bordered sigil badge of its own; as a phrase it costs a card no height.
  const oathPhrase = candidate.oath
    ? i18n.t(candidate.oathProven ? 'oath_sworn_to' : 'oath_seeking', { oath: oathLabel(candidate.oath) })
    : null;
  const eyebrow = [tierLabel(candidate.gemTier), candidate.city, oathPhrase].filter(Boolean).join(' · ');

  return (
    <View style={styles.card} onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}>
      {showPhoto ? (
        <Image
          source={{ uri: photo }}
          style={styles.photo}
          contentFit="cover"
          blurRadius={26}
          onError={() => setFailedUrl(photo)}
          testID="sealed-likeness"
        />
      ) : (
        <View style={styles.photoPlaceholder} />
      )}

      {/* A blur alone still shows hair, skin and a silhouette. The veil is what makes the plate
          read as sealed rather than as a photograph that failed to load. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <LinearGradient
          colors={[overlay(SCRIM.veil), overlay(SCRIM.veilStrong)]}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={[styles.sealArea, { paddingBottom: infoHeight }]} pointerEvents="none">
        <Image
          source={ORNAMENTS.knotGold}
          style={styles.seal}
          contentFit="contain"
          accessibilityRole="image"
          accessibilityLabel={i18n.t('seek_sealed_a11y')}
        />
        <SealDots broken={0} color={TEMPERATURE.furnace} size={12} />
        <Text style={styles.sealHint}>{i18n.t('seek_sealed_hint')}</Text>
      </View>

      <LinearGradient
        colors={['transparent', overlay(SCRIM.veilStrong), overlay(SCRIM.ceremony)]}
        style={StyleSheet.absoluteFill}
        locations={[Math.max(0, plaqueTop - 0.18), plaqueTop, 1]}
        pointerEvents="none"
      />

      <RoomLight />

      <View style={styles.info} onLayout={(e) => setInfoHeight(e.nativeEvent.layout.height)}>
        <View style={styles.plaqueRule} />
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{candidate.displayName}, {candidate.age}</Text>
          <GemTierBadge tier={candidate.gemTier} size={BADGE_SIZES.row} />
        </View>
        <CardEyebrow color={ACCENT.base} style={styles.eyebrow}>{eyebrow}</CardEyebrow>
        {candidate.equippedTitleId && (
          <Text style={styles.equippedTitle}>{itemLabel(candidate.equippedTitleId)}</Text>
        )}
        {candidate.bio ? (
          <Text style={styles.bio} numberOfLines={2}>{candidate.bio}</Text>
        ) : null}

        <View style={styles.actions}>
          <GameButton variant="ink" flex={1} disabled={requesting} onPress={onSkip}>{i18n.t('skip')}</GameButton>
          <GameButton variant="primary" flex={1.5} loading={requesting} disabled={requestDisabled} onPress={onRequest}>{i18n.t('send_summons')}</GameButton>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    // The Fire squares off: the hot rooms take the tight corner, the gold ones stay rounded.
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    backgroundColor: SURFACE.panel,
    borderWidth: 1,
    borderColor: LINE.edge,
  },
  photo: { ...StyleSheet.absoluteFillObject },
  photoPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: SURFACE.raised },
  sealArea: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
  },
  seal: { width: SEAL, height: SEAL },
  // Italic is the app speaking; the rest of the card is the person.
  sealHint: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.sm, color: INK.dim },
  info: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: SPACE.xxl,
    gap: SPACE.sm,
  },
  plaqueRule: { height: 1, backgroundColor: tint(TEMPERATURE.furnace, 0.6), marginBottom: SPACE.xs },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: FONT_SIZES.display,
    fontFamily: FONTS.display,
    color: INK.primary,
    letterSpacing: TRACKING.body,
    flex: 1,
  },
  // The plaque sets its own rhythm with `gap`; the eyebrow's own bottom margin would double it.
  eyebrow: { marginBottom: 0 },
  equippedTitle: { fontSize: FONT_SIZES.sm, fontFamily: FONTS.utility, color: ACCENT.base, letterSpacing: TRACKING.wide },
  bio: { fontSize: FONT_SIZES.lg, fontFamily: FONTS.body, color: INK.primary, lineHeight: LEADING.lg },
  actions: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.sm },
});
