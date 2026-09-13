import { useEffect, useRef, useState } from 'react';
import { Tap } from '../ui/Tap';
import { Animated, View, Text, Image, StyleSheet } from 'react-native';
import { colorForTier } from '../../lib/tiers';
import { i18n } from '../../lib/i18n';
import { fireEyebrow, fireLine, fireVerdict, type Fire } from '../../lib/fire';
import {
  ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, METAL, RADIUS, SPACE, SURFACE, TEMPERATURE, circle, tint,
} from '../../lib/theme';
import { Icon } from '../ui/Icon';
import { Glyph } from '../ui/Glyph';
import { PLACES } from '../ui/Places';
import { CardEyebrow } from '../ui/CardEyebrow';
import { FrostEdge } from '../vfx/FrostEdge';
import OathSigil from '../OathSigil';
import type { Match } from '../../models/match';

interface Props {
  match: Match;
  fire: Fire;
  onPress: () => void;
}

const Ember = PLACES.ember;

/** Roughly how deep the row reaches — just enough for `FrostEdge` to have a length to draw
 *  against when a fire freezes. Not load-bearing precision; the row's real height still moves
 *  with its content (an Oath sigil makes a row taller), same as before this move. */
const ROW_HEIGHT = 84;

/** The colour each fire state's eyebrow speaks in — `unlit` keeps the tile's original
 *  "New Quest" gold, since it is not a temperature at all yet, just an unopened scroll. */
function eyebrowColorFor(state: Fire['state']): string {
  switch (state) {
    case 'burning': return ACCENT.bright;
    case 'embers': return METAL.ember;
    case 'frozen': return TEMPERATURE.glacier;
    case 'unlit': return ACCENT.base;
  }
}

export function QuestTile({ match, fire, onPress }: Props) {
  const { otherUser, revealLevel } = match;
  const blurred = revealLevel < 2;
  const frozen = fire.state === 'frozen';
  const embers = fire.state === 'embers';

  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photo = otherUser.firstPhoto;
  const showPhoto = photo && photo !== failedUrl;
  const tier = (otherUser as any).gemTier ?? 'Garnet';
  const tierColor = colorForTier(tier);

  const wasBlurred = useRef(blurred);
  const reveal = useRef(new Animated.Value(blurred ? 0 : 1)).current;
  useEffect(() => {
    if (wasBlurred.current && !blurred) {
      Animated.timing(reveal, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }
    wasBlurred.current = blurred;
  }, [blurred, reveal]);

  const nameText = blurred
    ? i18n.t('mystery_match_name')
    : otherUser.isDeleted
      ? i18n.t('deleted_user')
      : (otherUser.displayName ?? i18n.t('unknown_name'));

  const eyebrow = fireEyebrow(fire);
  const line = fireLine(fire);
  const verdict = fireVerdict(fire);
  const eyebrowColor = eyebrowColorFor(fire.state);

  return (
    <Tap onPress={onPress} accessibilityLabel={`${nameText}. ${eyebrow}. ${line}`}>
      <View style={[styles.row, embers && { borderColor: tint(METAL.ember, 0.6) }]}>
        {frozen && (
          // Anchored top/bottom rather than given an explicit height, so its `height: '100%'`
          // resolves against this wrapper's own stretched size instead of the row's (which has
          // none — the row sizes to its content, same as always).
          <View style={styles.frostWrap} pointerEvents="none">
            <FrostEdge edge="left" length={ROW_HEIGHT} />
          </View>
        )}
        {fire.state === 'unlit' && (
          <View style={[styles.runeStrip, { backgroundColor: tint(ACCENT.base, 0.13), borderColor: tint(ACCENT.base, 0.4) }]}>
            <View style={[styles.runeCorner, styles.runeCornerTl, { borderColor: ACCENT.base }]} />
            <View style={[styles.runeCorner, styles.runeCornerBr, { borderColor: ACCENT.base }]} />
            <Icon name="script-text" size={ICON_SIZES.md} color={ACCENT.base} />
          </View>
        )}
        <View style={[styles.avatarRing, { borderColor: tint(tierColor, 0.5) }]}>
          {showPhoto ? (
            <>
              <Image
                source={{ uri: photo }}
                style={styles.avatar}
                blurRadius={18}
                onError={() => setFailedUrl(photo)}
              />
              <Animated.Image
                source={{ uri: photo }}
                style={[styles.avatar, styles.avatarSharpOverlay, { opacity: reveal }]}
                blurRadius={0}
              />
            </>
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Icon name="account" size={ICON_SIZES.xl} color={INK.dim} />
            </View>
          )}
          {frozen && <View style={styles.frozenOverlay} accessible={false} importantForAccessibility="no" />}
        </View>
        <View style={styles.info}>
          {blurred ? (
            <Text style={[styles.name, frozen && styles.nameFrozen]} numberOfLines={1}>{nameText}</Text>
          ) : (
            <Animated.Text
              style={[
                styles.name,
                frozen && styles.nameFrozen,
                { opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] },
              ]}
              numberOfLines={1}
            >
              {nameText}
            </Animated.Text>
          )}
          <OathSigil oath={otherUser.oath ?? null} proven={otherUser.oathProven ?? false} size="sm" />
          <View style={styles.eyebrowRow}>
            {fire.state === 'burning' && <Glyph name="flame" size={ICON_SIZES.sm} color={eyebrowColor} />}
            {embers && <Ember size={ICON_SIZES.sm} color={eyebrowColor} />}
            {frozen && <Glyph name="ice" size={ICON_SIZES.sm} color={eyebrowColor} />}
            <CardEyebrow color={eyebrowColor}>{eyebrow}</CardEyebrow>
          </View>
          {/* `fireLine` is '' for `unlit` on purpose — an empty second line would still take a
           *  row's worth of space under the eyebrow. */}
          {line ? <Text style={styles.fireLine}>{line}</Text> : null}
          {verdict ? <Text style={styles.verdict}>{verdict}</Text> : null}
        </View>
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.md,
    backgroundColor: SURFACE.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: LINE.edge,
    padding: SPACE.md,
    marginBottom: SPACE.md,
    overflow: 'hidden',
  },
  frostWrap: { position: 'absolute', top: 0, bottom: 0, left: 0 },
  runeStrip: {
    // Sized to the avatar beside it rather than stretched to the card: a card with an Oath sigil
    // is taller than one without, and `stretch` made the same tablet two different heights down
    // a single list.
    alignSelf: 'center',
    width: 30,
    height: 56,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  runeCorner: { position: 'absolute', width: 7, height: 7 },
  runeCornerTl: { top: 2, left: 2, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  runeCornerBr: { bottom: 2, right: 2, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  avatarRing: { ...circle(56), borderWidth: 2, overflow: 'hidden' },
  avatar: circle(52),
  avatarSharpOverlay: { position: 'absolute', top: 0, left: 0 },
  avatarPlaceholder: {
    flex: 1,
    backgroundColor: SURFACE.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The frost over a frozen portrait: a flat wash rather than a desaturation filter (RN has no
  // cheap one), which is enough to read as "gone cold" without a native image-processing module.
  frozenOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: TEMPERATURE.ice,
    opacity: 0.35,
  },
  info: { flex: 1, gap: SPACE.xs },
  name: { fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.lg, color: INK.primary },
  nameFrozen: { color: INK.dim },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  fireLine: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.dim },
  verdict: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.md, color: INK.dim },
});
