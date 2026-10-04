import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { GemTierBadge } from '../progression/GemTierBadge';
import { GameButton } from '../ui/GameButton';
import { CardEyebrow } from '../ui/CardEyebrow';
import { SealDots } from '../chat/SealDots';
import { RoomLight } from '../world/RoomLight';
import OathSigil, { OATH_NAME_KEYS, oathLabel } from '../OathSigil';
import { CandleRow } from '../hearth/CandleRow';
import { i18n, lineLocale } from '../../lib/i18n';
import { ORNAMENTS } from '../../lib/ornaments';
import { LEADING, ACCENT, BADGE_SIZES, FONTS, FONT_SIZES, INK, LINE, RADIUS, SCRIM, SPACE, SURFACE, TEMPERATURE, TRACKING, circle, overlay, tint } from '../../lib/theme';
import { TIER_NAME_KEYS, itemLabel, tierLabel, cityKey, cityLabel } from '../../lib/tiers';
import type { Candidate, GemTier, Oath } from '../../models/user';

/** The wax medallion that holds the likeness: a fifth of the stone, not the whole of it. */
const MEDALLION = 132;
/** The knot pressed into the medallion's wax. */
const SEAL = 92;
const RING = 2;
/** Where the medallion's centre sits below the card's top edge. Discover lands its request toast
 *  here: the wax is the same on every card, so covering it hides nothing of the next stranger. */
export const MEDALLION_CENTER = SPACE.xxl + MEDALLION / 2;

/** Her words are the hero, so they are set as large as their length allows and never cut short.
 *  The steps are by length rather than `adjustsFontSizeToFit`, which shrinks per line on Android. */
function bioSize(bio: string): { fontSize: number; lineHeight: number } {
  if (bio.length <= 110) return { fontSize: FONT_SIZES.title, lineHeight: LEADING.title };
  if (bio.length <= 220) return { fontSize: FONT_SIZES.xl, lineHeight: LEADING.xl };
  return { fontSize: FONT_SIZES.lg, lineHeight: LEADING.lg };
}

interface Props {
  candidate: Candidate;
  onRequest: () => void;
  onSkip: () => void;
  requesting?: boolean;
  requestDisabled?: boolean;
  /** Today's summons, drawn as candles beside the button that burns one. */
  budget?: { remaining: number; budget: number } | null;
}

/**
 * A stranger, as the Fire shows them: a carved standing stone, not a photo album.
 *
 * The face is earned in the thread, so the likeness is only a small medallion under wax with the
 * three intact seals drawn beneath it and the law stated once. It used to be the whole card — a
 * blurred plate with nothing on it, and everything that could be judged squeezed into a plaque at
 * the foot with the bio cut to two lines. What is left to decide on is what they wrote, so that is
 * the stone's face; the rank, district and oath are carved below it. Habits are deliberately not
 * here: they are the last rung of the reveal ladder (`SealsSheet`), and the engine does not send
 * them for a candidate.
 */
export function CandidateCard({ candidate, onRequest, onSkip, requesting, requestDisabled, budget }: Props) {
  const photo = candidate.sealedPhotoUrl;
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = photo && photo !== failedUrl;

  // One line, in the order the board reads it: rank, then where they are, then what they are here
  // for. Said in one language as a whole: a piece still awaiting Mongolian used to leave the line
  // half and half ("БОЛОР · BAYANGOL · SEEKING ХУВЬ ЗАЯАНД НЭЭЛТТЭЙ").
  const oathKey = candidate.oathProven ? 'oath_sworn_to' : 'oath_seeking';
  const said = lineLocale(...[
    TIER_NAME_KEYS[candidate.gemTier as GemTier],
    cityKey(candidate.city),
    candidate.oath ? oathKey : null,
    candidate.oath ? OATH_NAME_KEYS[candidate.oath as Oath] : null,
  ].filter((key): key is string => !!key));
  const oathPhrase = candidate.oath
    ? i18n.t(oathKey, { oath: oathLabel(candidate.oath, said), locale: said })
    : null;
  const eyebrow = [tierLabel(candidate.gemTier, said), cityLabel(candidate.city, said), oathPhrase]
    .filter(Boolean).join(' · ');
  const bio = candidate.bio?.trim() ?? '';

  return (
    <View style={styles.card}>
      <RoomLight />

      <View style={styles.medallionBlock}>
        <View style={styles.medallion}>
          {showPhoto ? (
            <Image
              source={{ uri: photo }}
              style={styles.likeness}
              contentFit="cover"
              blurRadius={26}
              onError={() => setFailedUrl(photo)}
              testID="sealed-likeness"
            />
          ) : (
            <View style={styles.likenessPlaceholder} />
          )}
          {/* A blur alone still shows hair, skin and a silhouette; the veil makes it wax. */}
          <LinearGradient
            colors={[overlay(SCRIM.veil), overlay(SCRIM.veilStrong)]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
          <Image
            source={ORNAMENTS.knotGold}
            style={styles.seal}
            contentFit="contain"
            accessibilityRole="image"
            accessibilityLabel={i18n.t('seek_sealed_a11y')}
          />
        </View>
        <SealDots broken={0} color={TEMPERATURE.furnace} size={10} />
        <Text style={styles.sealHint}>{i18n.t('seek_sealed_hint')}</Text>
      </View>

      <View style={styles.face}>
        {bio ? (
          <Text style={[styles.bio, bioSize(bio)]} testID="candidate-bio">{bio}</Text>
        ) : null}
        <OathSigil oath={candidate.oath ?? null} proven={candidate.oathProven ?? false} bare />
      </View>

      <View style={styles.plaque}>
        <View style={styles.plaqueRule} />
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>{i18n.t('name_age', { name: candidate.displayName, age: candidate.age })}</Text>
          <GemTierBadge tier={candidate.gemTier} size={BADGE_SIZES.row} />
        </View>
        <CardEyebrow color={ACCENT.base} style={styles.eyebrow}>{eyebrow}</CardEyebrow>
        {candidate.equippedTitleId && (
          <Text style={styles.equippedTitle}>{itemLabel(candidate.equippedTitleId)}</Text>
        )}

        <View style={styles.actions}>
          <GameButton variant="ink" flex={1} disabled={requesting} onPress={onSkip}>{i18n.t('skip')}</GameButton>
          <GameButton variant="primary" flex={1.5} loading={requesting} disabled={requestDisabled} onPress={onRequest}>{i18n.t('send_summons')}</GameButton>
        </View>
        {budget && budget.budget > 0 && (
          <View style={styles.candles}>
            <CandleRow remaining={budget.remaining} budget={budget.budget} />
          </View>
        )}
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
  medallionBlock: { alignItems: 'center', gap: SPACE.sm, paddingTop: SPACE.xxl },
  medallion: {
    ...circle(MEDALLION),
    overflow: 'hidden',
    borderWidth: RING,
    borderColor: tint(TEMPERATURE.furnace, 0.7),
    backgroundColor: SURFACE.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeness: { ...StyleSheet.absoluteFillObject },
  likenessPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: SURFACE.raised },
  seal: { width: SEAL, height: SEAL },
  // Italic is the app speaking; the rest of the card is the person. Full ink, not `INK.dim`: it
  // once sat on the blurred plate itself, and the contrast assertion in the test still holds it.
  sealHint: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.sm, color: INK.primary },
  // The stone's face: what they wrote, centred in whatever room the medallion and plaque leave.
  face: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.lg,
    paddingHorizontal: SPACE.xxl,
  },
  bio: { fontFamily: FONTS.body, color: INK.primary, textAlign: 'center' },
  plaque: { paddingHorizontal: SPACE.xxl, paddingBottom: SPACE.xl, gap: SPACE.sm },
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
  actions: { flexDirection: 'row', gap: SPACE.md, marginTop: SPACE.sm },
  candles: { alignItems: 'flex-end' },
});
