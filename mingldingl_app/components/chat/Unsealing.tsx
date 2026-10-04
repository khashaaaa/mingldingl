import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ChestBurst } from '../vfx/ChestBurst';
import { ORNAMENTS } from '../../lib/ornaments';
import { signal } from '../../lib/world/feedback';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { ACCENT, CARVING, FONTS, FONT_SIZES, INK, LEADING, SCRIM, SPACE, SURFACE, circle, overlay, tint } from '../../lib/theme';
import { i18n } from '../../lib/i18n';
import { BANNER_RING } from '../cards/bannerImages';
import { AppModal } from '../modals/AppModal';
import { COVER_MS, InkWash } from '../vfx/InkWash';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** The photo that just came unlocked, or null when this rung revealed only fields. */
  photoUri: string | null;
  headline: string;
  subline: string;
}

const SEAL = 148;
/** The medallion the face resolves in: the Seek card's wax medallion, grown to fill the stage. */
const PLATE = 220;
/** The pecked sun ring round it, in the same proportion the Seek card's ring has to its medallion. */
const SUN = Math.round(PLATE * (196 / 132));
/** The ring is pecked into the dark, not lit: quiet behind the face. */
const SUN_OPACITY = 0.4;

/**
 * The beat where a seal breaks.
 *
 * Progressive reveal is the mechanic this whole product is built to replace the swipe loop with,
 * and until now its entire visual treatment was a 36px tile swapping a padlock glyph for an image
 * — the most earned moment in the app rendered as a receipt. This is the ceremony that moment was
 * missing: the Ulzii knot stands in as the seal, breaks, and the face behind it resolves out of
 * blur.
 *
 * It adds no new copy. The headline and subline are the strings the reveal strip already uses, so
 * the ceremony ships in both languages on the day it lands rather than joining the
 * `AWAITING_MN_TRANSLATION` debt list.
 */
export function Unsealing({ visible, onDismiss, photoUri, headline, subline }: Props) {
  const level = useVfxLevel();
  const animate = motionAllowed(level);
  const [burst, setBurst] = useState(0);
  // The ceremony opens from ink: a wash spreads over the chat and becomes its dark ground, and the
  // seal arrives once it has. Until then the scrim is clear, so the wash is what is seen.
  const [inked, setInked] = useState(false);
  const onInked = useCallback(() => setInked(true), []);

  const seal = useRef(new Animated.Value(0)).current;
  const shatter = useRef(new Animated.Value(0)).current;
  const plate = useRef(new Animated.Value(0)).current;
  const sharp = useRef(new Animated.Value(0)).current;
  const caption = useRef(new Animated.Value(0)).current;
  const hint = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) { setInked(false); return; }

    // Reduce-motion still gets the reveal — it is information, not decoration — with everything
    // already at rest. The haptic still fires: it is not motion, and it is the part that lands.
    if (!animate) {
      seal.setValue(0);
      shatter.setValue(1);
      plate.setValue(1);
      sharp.setValue(1);
      caption.setValue(1);
      hint.setValue(1);
      signal('sealBreak');
      return;
    }

    seal.setValue(0);
    shatter.setValue(0);
    plate.setValue(0);
    sharp.setValue(0);
    caption.setValue(0);
    hint.setValue(0);

    const sealBreaksAt = COVER_MS + 700;
    const timer = setTimeout(() => {
      signal('sealBreak');
      setBurst((n) => n + 1);
    }, sealBreaksAt);

    Animated.sequence([
      Animated.delay(COVER_MS + 120),
      // The seal arrives and settles.
      Animated.timing(seal, { toValue: 1, duration: 340, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true }),
      Animated.delay(sealBreaksAt - COVER_MS - 460),
      Animated.parallel([
        // It does not fade — it flies apart, which is what the burst underneath is drawing.
        Animated.timing(shatter, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(120),
          Animated.timing(plate, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
      ]),
      // Blur to sharp, slowly. This is the part that should feel like recognising someone.
      Animated.parallel([
        Animated.timing(sharp, { toValue: 1, duration: 760, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(200),
          Animated.timing(caption, { toValue: 1, duration: 320, useNativeDriver: true }),
        ]),
      ]),
      // Only once the face has resolved does the screen say how to leave it.
      Animated.delay(700),
      Animated.timing(hint, { toValue: 1, duration: 480, useNativeDriver: true }),
    ]).start();

    return () => clearTimeout(timer);
  }, [visible, animate, seal, shatter, plate, sharp, caption, hint]);

  if (!visible) return null;

  return (
    <AppModal visible transparent animationType={animate ? 'none' : 'fade'} onRequestClose={onDismiss}>
      <Pressable
        style={[styles.scrim, animate && !inked && styles.scrimClear]}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel={headline}
        testID="unsealing"
      >
        {animate && !inked && (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <InkWash mode="cover" onCovered={onInked} />
          </View>
        )}
        <View style={styles.stage}>
          <Animated.Image
            source={BANNER_RING}
            resizeMode="contain"
            style={[styles.sun, { opacity: Animated.multiply(plate, SUN_OPACITY) }]}
          />
          {photoUri && (
            <Animated.View
              style={[styles.plate, {
                opacity: plate,
                transform: [{ scale: plate.interpolate({ inputRange: [0, 1], outputRange: [1.14, 1] }) }],
              }]}
            >
              {/* Two copies rather than an animated `blurRadius`: re-rasterising a blur every
                  frame is the expensive way to do the cheapest possible cross-fade. */}
              <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={26} />
              <Animated.View style={[StyleSheet.absoluteFill, { opacity: sharp }]}>
                <Image
                  source={{ uri: photoUri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  testID="unsealing-photo"
                />
              </Animated.View>
            </Animated.View>
          )}

          <View style={styles.burst} pointerEvents="none">
            <ChestBurst size={PLATE} trigger={burst} />
          </View>

          <Animated.Image
            source={ORNAMENTS.knotGold}
            resizeMode="contain"
            style={[styles.seal, {
              opacity: Animated.multiply(seal, shatter.interpolate({ inputRange: [0, 1], outputRange: [1, 0] })),
              transform: [
                { scale: Animated.multiply(
                  seal.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
                  shatter.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }),
                ) },
                { rotate: shatter.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '14deg'] }) },
              ],
            }]}
          />
        </View>

        <Animated.View style={[styles.copy, { opacity: caption }]}>
          <Text style={styles.headline} numberOfLines={2}>{headline}</Text>
          <Text style={styles.subline} numberOfLines={3}>{subline}</Text>
          <Animated.Text style={[styles.hint, { opacity: hint }]}>{i18n.t('ceremony_continue')}</Animated.Text>
        </Animated.View>
      </Pressable>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    // `SCRIM.ceremony` is 0.97 because of this screen: at 0.92 the chat behind stayed legible
    // on device and the headline landed on top of a message bubble. A ceremony has to be the
    // only thing on screen, so that measurement is now what every ceremony in the app uses.
    backgroundColor: overlay(SCRIM.ceremony),
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.gutter,
    gap: SPACE.huge,
  },
  scrimClear: { backgroundColor: 'transparent' },
  stage: { width: SUN, height: SUN, alignItems: 'center', justifyContent: 'center' },
  sun: { position: 'absolute', width: SUN, height: SUN, tintColor: CARVING.stone },
  // Round, like the sealed medallion on the Seek card it was hidden in — but ringed in gold: the
  // furnace belongs to the Fire, and the thread is not the Fire (`furnace.test.ts`).
  plate: {
    position: 'absolute',
    ...circle(PLATE),
    borderWidth: 2,
    borderColor: tint(ACCENT.base, 0.7),
    overflow: 'hidden',
    backgroundColor: SURFACE.sunken,
  },
  burst: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  seal: { width: SEAL, height: SEAL },
  copy: { alignItems: 'center', gap: SPACE.xs, maxWidth: 320 },
  headline: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.display,
    lineHeight: LEADING.display,
    color: INK.primary,
    textAlign: 'center',
  },
  // Italic is the app speaking: what the seal gave, and when the next one breaks.
  subline: {
    fontFamily: FONTS.bodyItalic,
    fontSize: FONT_SIZES.md,
    lineHeight: LEADING.md,
    color: INK.dim,
    textAlign: 'center',
  },
  hint: { marginTop: SPACE.xl, fontFamily: FONTS.bodyItalic, fontSize: FONT_SIZES.sm, color: INK.muted },
});
