import { useEffect, useRef, useState } from 'react';
import { Tap } from '../ui/Tap';
import { Animated, View, Text, Image, StyleSheet } from 'react-native';
import { i18n } from '../../lib/i18n';
import { fireEyebrow, fireLine, fireMark, fireVerdict, type Fire } from '../../lib/fire';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import {
  ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, METAL, RADIUS, SPACE, SURFACE, TEMPERATURE, circle, tint,
} from '../../lib/theme';
import { Icon } from '../ui/Icon';
import { FireMarkGlyph } from './FireMarkGlyph';
import { CardEyebrow } from '../ui/CardEyebrow';
import OathSigil from '../OathSigil';
import type { Match } from '../../models/match';

interface Props {
  match: Match;
  fire: Fire;
  onPress: () => void;
}

export function QuestTile({ match, fire, onPress }: Props) {
  const { otherUser, revealLevel } = match;
  const blurred = revealLevel < 2;
  const frozen = fire.state === 'frozen';
  const embers = fire.state === 'embers';

  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const photo = otherUser.firstPhoto;
  const showPhoto = photo && photo !== failedUrl;
  // The engine's `PartialUserProfile` carries no gem tier, so this ring used to read an `as any`
  // field that was always absent and tint every portrait Garnet. It is an edge, not a rank.

  const wasBlurred = useRef(blurred);
  const reveal = useRef(new Animated.Value(blurred ? 0 : 1)).current;
  const animate = motionAllowed(useVfxLevel());
  useEffect(() => {
    if (wasBlurred.current && !blurred) {
      if (animate) Animated.timing(reveal, { toValue: 1, duration: 500, useNativeDriver: true }).start();
      else reveal.setValue(1);
    }
    wasBlurred.current = blurred;
  }, [blurred, animate, reveal]);

  const nameText = blurred
    ? i18n.t('mystery_match_name')
    : otherUser.isDeleted
      ? i18n.t('deleted_user')
      : (otherUser.displayName ?? i18n.t('unknown_name'));

  const eyebrow = fireEyebrow(fire);
  const line = fireLine(fire);
  const verdict = fireVerdict(fire);
  // `unlit` keeps the tile's original "New Quest" gold: not a temperature yet, just an unopened scroll.
  const mark = fireMark(fire.state, ACCENT.base);
  const eyebrowColor = mark.color;

  return (
    <Tap
      onPress={onPress}
      accessibilityRole="button"
      // The verdict `Text` sits below `line` in the tree, but the `Tap` groups every descendant
      // under this one label, so a screen reader never reaches it on its own — it has to be
      // folded in here. `filter(Boolean)` also drops the trailing ". " an unlit row's empty
      // `line` would otherwise leave dangling.
      accessibilityLabel={[nameText, eyebrow, line, verdict].filter(Boolean).join('. ')}
    >
      {/* A frozen fire is told by temperature alone — a cold hairline, the same move embers make in
          ember. The left-edge `FrostEdge` it used to carry read as a ruler scribbled behind the
          portrait on hardware, and the glacier mark, line and verdict already say "frozen". */}
      <View
        style={[
          styles.row,
          embers && { borderColor: tint(METAL.ember, 0.6) },
          frozen && { borderColor: tint(TEMPERATURE.glacier, 0.35) },
        ]}
      >
        {fire.state === 'unlit' && (
          <View style={[styles.runeStrip, { backgroundColor: tint(ACCENT.base, 0.13), borderColor: tint(ACCENT.base, 0.4) }]}>
            <View style={[styles.runeCorner, styles.runeCornerTl, { borderColor: ACCENT.base }]} />
            <View style={[styles.runeCorner, styles.runeCornerBr, { borderColor: ACCENT.base }]} />
            <Icon name="script-text" size={ICON_SIZES.md} color={ACCENT.base} />
          </View>
        )}
        <View style={[styles.avatarRing, frozen && { borderColor: tint(TEMPERATURE.glacier, 0.5) }]}>
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
            <FireMarkGlyph mark={mark} size={ICON_SIZES.sm} />
            <CardEyebrow color={eyebrowColor} style={styles.eyebrowInline}>{eyebrow}</CardEyebrow>
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
  runeCornerTl: { top: SPACE.hair, left: SPACE.hair, borderTopWidth: 1.5, borderLeftWidth: 1.5 },
  runeCornerBr: { bottom: SPACE.hair, right: SPACE.hair, borderBottomWidth: 1.5, borderRightWidth: 1.5 },
  avatarRing: { ...circle(56), borderWidth: 2, borderColor: LINE.edge, overflow: 'hidden' },
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
    opacity: 0.2,
  },
  info: { flex: 1, gap: SPACE.xs },
  name: { fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.lg, color: INK.primary },
  nameFrozen: { color: INK.dim },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  // `CardEyebrow`'s own bottom margin is for an eyebrow above a block; beside a mark in a centred
  // row it lifted the label and left the mark sitting visibly lower.
  eyebrowInline: { marginBottom: 0 },
  fireLine: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.dim },
  verdict: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.md, color: INK.dim },
});
