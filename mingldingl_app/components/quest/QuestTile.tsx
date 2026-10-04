import { useEffect, useRef, useState } from 'react';
import { Tap } from '../ui/Tap';
import { Animated, View, Text, Image, StyleSheet } from 'react-native';
import { i18n } from '../../lib/i18n';
import { fireEyebrow, fireLine, fireMark, fireVerdict, type Fire } from '../../lib/fire';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import {
  ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, METAL, SPACE, SURFACE, TEMPERATURE, circle, tint,
} from '../../lib/theme';
import { Icon } from '../ui/Icon';
import { FireMarkGlyph } from './FireMarkGlyph';
import { CardEyebrow } from '../ui/CardEyebrow';
import OathSigil from '../OathSigil';
import type { Match } from '../../models/match';
import { ORNAMENTS } from '../../lib/ornaments';

interface Props {
  match: Match;
  fire: Fire;
  onPress: () => void;
  /** Where this bead sits on its thread: the cord stops at the first bead above and the last below. */
  first?: boolean;
  last?: boolean;
}

/** The thread's colour through a bead: the fire's own temperature, a dim gold before it is lit. */
function threadColor(fire: Fire): string {
  if (fire.state === 'unlit') return tint(ACCENT.base, 0.45);
  if (fire.state === 'frozen') return tint(TEMPERATURE.glacier, 0.55);
  return fireMark(fire.state).color;
}

export function QuestTile({ match, fire, onPress, first = false, last = false }: Props) {
  const { otherUser, revealLevel } = match;
  const blurred = revealLevel < 2;
  const frozen = fire.state === 'frozen';
  const embers = fire.state === 'embers';
  const unlit = fire.state === 'unlit';

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
  // A severed match is a cut thread: no cord runs into or out of its bead.
  const cut = frozen && fire.frozenBy === 'severed';
  const cord = threadColor(fire);

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
      {/* No box: the log is one thread with every quest a bead on it. The cord runs down the
          portrait column, coloured by each fire's temperature, so the whole log reads as one
          strand going from gold to ember to ice; a severed match is where the strand is cut. */}
      <View style={styles.row}>
        <View style={styles.rail}>
          <View style={styles.cordTop}>
            {!first && !cut && <Image source={ORNAMENTS.cord} resizeMode="repeat" style={[styles.cordStrand, { tintColor: cord }]} testID="quest-cord-top" />}
          </View>
          {/* One portrait column for every row, so names start at the same x all the way down the
              log; an unopened quest is said on the portrait — a gold ring and the scroll as a seal. */}
          <View style={styles.portrait}>
            <View style={[styles.avatarRing, { borderColor: cord }, unlit && { borderColor: ACCENT.base }]}>
              {showPhoto ? (
                <>
                  <Image
                    source={{ uri: photo }}
                    style={styles.avatar}
                    // Decoded at the avatar's size before the blur, not at the photo's: a full-size
                    // bitmap took the same radius as a light haze and the face stayed recognisable.
                    resizeMethod="resize"
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
            {unlit && (
              <View style={styles.newSeal}>
                <Icon name="script-text" size={ICON_SIZES.sm} color={ACCENT.base} />
              </View>
            )}
          </View>
          <View style={styles.cordBottom}>
            {!last && !cut && <Image source={ORNAMENTS.cord} resizeMode="repeat" style={[styles.cordStrand, { tintColor: cord }]} testID="quest-cord-bottom" />}
          </View>
        </View>
        <View style={[styles.info, !last && styles.infoRule, embers && { borderBottomColor: tint(METAL.ember, 0.5) }]}>
          <View style={styles.header}>
            <View style={styles.titles}>
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
              <View style={styles.eyebrowRow}>
                <FireMarkGlyph mark={mark} size={ICON_SIZES.sm} />
                <CardEyebrow color={eyebrowColor} style={styles.eyebrowInline}>{eyebrow}</CardEyebrow>
              </View>
            </View>
            {/* The vow at the row's right edge, out of the reading column, and unboxed: a sigil
                over its state word, the only mark in the row that is not the fire's. */}
            <OathSigil oath={otherUser.oath ?? null} proven={otherUser.oathProven ?? false} size="sm" bare />
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

const PORTRAIT = 56;
const CORD = 2;
/** The twisted cord's own width (`scripts/gen-ornaments.js`, `cord.png`: 6×10pt, repeating). */
const STRAND = 6;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACE.md },
  // The portrait column, stretched to the row's height so the cord below the bead reaches the next.
  rail: { width: PORTRAIT, alignItems: 'center', alignSelf: 'stretch' },
  cordTop: { width: STRAND, height: SPACE.md },
  cordBottom: { width: STRAND, flex: 1, minHeight: SPACE.md },
  cordStrand: { ...StyleSheet.absoluteFillObject, width: STRAND, height: undefined },
  portrait: { width: PORTRAIT, height: PORTRAIT },
  newSeal: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    zIndex: 1,
    ...circle(24),
    backgroundColor: SURFACE.panel,
    borderWidth: 1.5,
    borderColor: ACCENT.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarRing: { ...circle(PORTRAIT), borderWidth: CORD, overflow: 'hidden', backgroundColor: SURFACE.panel },
  avatar: circle(PORTRAIT - CORD * 2),
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
  // The hairline between quests starts after the thread, so the cord is never crossed by it.
  info: { flex: 1, gap: SPACE.sm, paddingVertical: SPACE.md },
  infoRule: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: LINE.hairline },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACE.sm, minHeight: PORTRAIT },
  titles: { flex: 1, gap: SPACE.xs, justifyContent: 'center', alignSelf: 'stretch' },
  // The person's name in the display voice: the row's one heading.
  name: { fontFamily: FONTS.display, fontSize: FONT_SIZES.lg, color: INK.primary },
  nameFrozen: { color: INK.dim },
  eyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: SPACE.xs },
  // `CardEyebrow`'s own bottom margin is for an eyebrow above a block; beside a mark in a centred
  // row it lifted the label and left the mark sitting visibly lower.
  eyebrowInline: { marginBottom: 0 },
  fireLine: { fontFamily: FONTS.body, fontSize: FONT_SIZES.md, color: INK.dim },
  verdict: { fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.md, color: INK.dim },
});
