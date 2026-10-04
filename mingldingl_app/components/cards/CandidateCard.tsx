import { useState } from 'react';
import { View, Text, StyleSheet, Image as PlainImage, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { GemTierBadge } from '../progression/GemTierBadge';
import { GameButton } from '../ui/GameButton';
import { CardEyebrow } from '../ui/CardEyebrow';
import { SealDots } from '../chat/SealDots';
import { RoomLight } from '../world/RoomLight';
import { OATH_NAME_KEYS, oathLabel } from '../OathSigil';
import { Glyph } from '../ui/Glyph';
import { i18n, lineLocale } from '../../lib/i18n';
import { BANNER_SEAL, SEAL_PRESS_SHARE } from './bannerImages';
import { BRUSH_CARD_EDGE, BRUSH_CARD_EDGE_ASPECT, BRUSH_CARD_RING, BRUSH_CARD_RULE, BRUSH_CARD_RULE_ASPECT } from '../ui/brushImages';
import { LEADING, BADGE_SIZES, FONTS, ACCENT, FONT_SIZES, GEM_COLORS, ICON_SIZES, INK, LINE, MATERIAL, RADIUS, SPACE, SURFACE, TEMPERATURE, THREAD, TRACKING, circle } from '../../lib/theme';
import { TIER_NAME_KEYS, itemLabel, tierLabel, cityKey, cityLabel } from '../../lib/tiers';
import type { Candidate, GemTier, Oath } from '../../models/user';

/** The sealed likeness, ribbons and all. The wax is ~0.6 of this: one quiet mark at the head that
 *  is the same on every card, so the person under it — name, words — is what the eye lands on. */
const MEDALLION = 112;
/** The pressed face of the wax, where the blurred likeness shows through as a ghost of colour. */
const LIKENESS = Math.round(MEDALLION * SEAL_PRESS_SHARE);
/** The open brushed ring behind the wax, a little wider than the seal so the stroke rings it. */
const RING = 148;
/** Where the medallion's centre sits below the card's top edge. Discover lands its request toast
 *  here: the wax is the same on every card, so covering it hides nothing of the next stranger. */
export const MEDALLION_CENTER = 1 + SPACE.xl + MEDALLION / 2;

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
 * A stranger, as the Fire shows them: a plain card, the gem a brush stroke along its top, and
 * their words as its face. Its three lines — that stroke, the ring round the seal, the rule over the
 * buttons — are dry-brushed in the glyphs' ink (`scripts/gen-brush.js`), not ruled.
 *
 * It was a blurred photo plate, a carved stone, a deer stone and a herald's banner in turn; each
 * built a bigger object round very little (a name, a rank, a district, an oath, a few sentences),
 * and the frame ended up louder than the person. The room around it already carries the world,
 * so the card itself stays quiet.
 *
 * The face is earned in the thread, so the likeness is only a ghost of colour under the wax seal at
 * the card's head, with the three intact seals and the law stated once. Habits are deliberately not
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

  // The strokes are sized in points off the card's own measure: an absolutely placed image lost to
  // its intrinsic size on Android.
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) setWidth(w);
  };
  const edgeWidth = width - SPACE.sm * 2;
  const ruleWidth = width - SPACE.xl * 2;

  return (
    <View style={styles.card} onLayout={onLayout} testID="candidate-card">
      <RoomLight />
      {/* The gem, said as one dry-brushed stroke along the top: pressed down at the left, dragged
          across until the brush runs out. */}
      {edgeWidth > 0 && (
        <PlainImage
          source={BRUSH_CARD_EDGE}
          resizeMode="stretch"
          style={[styles.edge, { width: edgeWidth, height: edgeWidth / BRUSH_CARD_EDGE_ASPECT, tintColor: GEM_COLORS[candidate.gemTier as GemTier] ?? LINE.edge }]}
          accessible={false}
          testID="ink-edge"
        />
      )}

      <View style={styles.body}>
        {/* The head: the sealed likeness under wax, the law beside its three seals, and straight
            under it who this is. */}
        <View style={styles.medallionBlock}>
          {/* One brush stroke round the seal, left open where the brush lifts: the face not yet given. */}
          <PlainImage source={BRUSH_CARD_RING} resizeMode="contain" style={styles.ring} accessible={false} testID="ink-ring" />
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
            ) : null}
            {/* The wax is laid over the likeness: its pressed face is translucent enough that a blur
                of their colours shows, and no more. */}
            <PlainImage
              source={BANNER_SEAL}
              style={styles.wax}
              accessibilityRole="image"
              accessibilityLabel={i18n.t('seek_sealed_a11y')}
            />
          </View>
          <View style={styles.law}>
            <SealDots broken={0} color={TEMPERATURE.furnace} size={8} />
            <Text style={styles.sealHint}>{i18n.t('seek_sealed_hint')}</Text>
          </View>
        </View>

        <View style={styles.who}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{i18n.t('name_age', { name: candidate.displayName, age: candidate.age })}</Text>
            <GemTierBadge tier={candidate.gemTier} size={BADGE_SIZES.row} />
          </View>
          {/* Rank, district and the oath, said once. */}
          <CardEyebrow color={THREAD.gold} style={styles.eyebrow}>{eyebrow}</CardEyebrow>
          {candidate.equippedTitleId && (
            <Text style={styles.equippedTitle}>{itemLabel(candidate.equippedTitleId)}</Text>
          )}
        </View>

        {/* The card's face: what they wrote, centred in whatever room the head and the foot leave. */}
        <View style={styles.face}>
          {bio ? (
            <Text style={[styles.bio, bioSize(bio)]} testID="candidate-bio">{bio}</Text>
          ) : null}
        </View>

        <View style={styles.foot}>
          {ruleWidth > 0 && (
            <PlainImage
              source={BRUSH_CARD_RULE}
              resizeMode="stretch"
              style={[styles.rule, { width: ruleWidth, height: ruleWidth / BRUSH_CARD_RULE_ASPECT }]}
              accessible={false}
              testID="ink-rule"
            />
          )}
          <View style={styles.actions}>
            <GameButton variant="ink" flex={1} disabled={requesting} onPress={onSkip}>{i18n.t('skip')}</GameButton>
            <GameButton variant="primary" flex={1.5} loading={requesting} disabled={requestDisabled} onPress={onRequest}>{i18n.t('send_summons')}</GameButton>
          </View>
          {/* What a summons costs, said once under the button that spends it. */}
          {budget && budget.budget > 0 && (
            <View style={styles.tally} testID="candle-tally" accessible accessibilityLabel={i18n.t('candles_left', budget)}>
              <Glyph name="candle" size={ICON_SIZES.md} color={budget.remaining > 0 ? MATERIAL.wax : INK.muted} />
              <Text style={styles.tallyText}>{i18n.t('candles_left', budget)}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: SURFACE.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: LINE.hairline,
  },
  edge: { position: 'absolute', top: 0, left: SPACE.sm },
  body: { flex: 1, padding: SPACE.xl, paddingBottom: SPACE.lg },
  medallionBlock: { alignItems: 'center', gap: SPACE.xs },
  law: { flexDirection: 'row', alignItems: 'center', gap: SPACE.sm },
  // Centred on the medallion: the block is centred, and the ring is the medallion grown evenly.
  ring: { position: 'absolute', top: (MEDALLION - RING) / 2, width: RING, height: RING, tintColor: ACCENT.base, opacity: 0.4 },
  medallion: { width: MEDALLION, height: MEDALLION, alignItems: 'center', justifyContent: 'center' },
  likeness: { ...circle(LIKENESS), position: 'absolute' },
  wax: { width: MEDALLION, height: MEDALLION },
  // Italic is the app speaking; the rest of the card is the person.
  sealHint: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.sm, color: INK.primary },
  who: { alignItems: 'center', gap: SPACE.xs, marginTop: SPACE.md },
  face: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: SPACE.lg },
  bio: { fontFamily: FONTS.body, color: INK.primary, textAlign: 'center' },
  // One brushed line between the person and what you do about them.
  foot: { gap: SPACE.sm, alignItems: 'stretch' },
  rule: { alignSelf: 'center', tintColor: LINE.edge, marginBottom: SPACE.xs },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACE.sm,
    maxWidth: '100%',
  },
  name: {
    fontSize: FONT_SIZES.display,
    fontFamily: FONTS.display,
    color: INK.primary,
    letterSpacing: TRACKING.body,
    flexShrink: 1,
  },
  // The block sets its own rhythm with `gap`; the eyebrow's own bottom margin would double it.
  eyebrow: { marginBottom: 0, textAlign: 'center' },
  equippedTitle: { fontSize: FONT_SIZES.sm, fontFamily: FONTS.utility, color: THREAD.gold, letterSpacing: TRACKING.wide },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACE.md },
  tally: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACE.xs },
  tallyText: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.sm, color: INK.dim },
});
