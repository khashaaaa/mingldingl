import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../ui/Icon';
import { TorchGlow } from '../vfx/TorchGlow';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACE } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

interface Props {
  /** Consecutive daily logins. Anything past seven keeps every flame lit. */
  days: number;
}

/** The seventh dawn is the Seven Dawns honour, so the lantern holds exactly seven flames. */
export const LANTERN_SLOTS = 7;

const SLOT = 28;
const GLYPH = 22;
const SLOT_GAP = SPACE.xs;
const PANEL_PAD_X = SPACE.md;
const ROW_WIDTH = LANTERN_SLOTS * SLOT + (LANTERN_SLOTS - 1) * SLOT_GAP;
/** The glow is drawn at 1.8× its `size`; stretched sideways it becomes one halo the row's width. */
const GLOW_SIZE = SLOT + SPACE.md;
const GLOW_STRETCH = ROW_WIDTH / GLOW_SIZE;

const FLICKER_LOW = 0.85;
const FLICKER_HIGH = 1;

function clampDays(days: number): number {
  return Math.max(0, Math.min(LANTERN_SLOTS, Math.floor(days)));
}

/**
 * The streak as a lantern: seven flame slots, one lit per consecutive dawn, so the walk to the
 * Seven Dawns honour is something the eye counts rather than a number it reads.
 *
 * Lit flames share one flicker loop and one glow — seven glows would be seven canvases for one
 * light. When the count falls (a ghosting penalty halves it) the flames that went out gutter and
 * fade before the slot settles to an unlit wick; under `still` they simply switch off, and the
 * flicker loop never starts.
 */
export function Lantern({ days }: Props) {
  const level = useVfxLevel();
  const animate = motionAllowed(level);
  const target = clampDays(days);

  // `shown` is how many slots currently render as lit; it trails `target` only for as long as a
  // blow-out takes, so the flames going out are still mounted while they gutter.
  const [shown, setShown] = useState(target);
  const prev = useRef(target);
  const lit = useRef(Array.from({ length: LANTERN_SLOTS }, (_, i) => new Animated.Value(i < target ? 1 : 0))).current;
  const flicker = useRef(new Animated.Value(FLICKER_HIGH)).current;
  const running = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (prev.current === target) return;
    const from = prev.current;
    prev.current = target;
    running.current?.stop();
    running.current = null;

    if (target > from) {
      setShown(target);
      const newly = lit.slice(from, target);
      if (!animate) {
        newly.forEach((v) => v.setValue(1));
        return;
      }
      newly.forEach((v) => v.setValue(0));
      const kindle = Animated.stagger(80, newly.map((v) => Animated.timing(v, {
        toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true,
      })));
      running.current = kindle;
      kindle.start(() => { running.current = null; });
      return;
    }

    const gone = lit.slice(target, from);
    if (!animate) {
      gone.forEach((v) => v.setValue(0));
      setShown(target);
      return;
    }
    // A flame does not click off: it gutters — two quick dips — and then fades to the wick.
    const blowOut = Animated.parallel(gone.map((v) => Animated.sequence([
      Animated.timing(v, { toValue: 0.35, duration: 60, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.25, duration: 60, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ])));
    running.current = blowOut;
    blowOut.start(({ finished }) => {
      running.current = null;
      if (!finished) return;
      gone.forEach((v) => v.setValue(0));
      setShown(target);
    });
  }, [target, animate, lit]);

  useEffect(() => () => { running.current?.stop(); }, []);

  // One shared flicker for every lit flame. A gentle breath, not a strobe, and only while there is
  // something lit to breathe.
  useEffect(() => {
    if (!animate || shown === 0) {
      flicker.setValue(FLICKER_HIGH);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flicker, { toValue: FLICKER_LOW, duration: 420, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(flicker, { toValue: FLICKER_HIGH, duration: 520, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animate, shown, flicker]);

  const caption = days >= LANTERN_SLOTS
    ? i18n.t('streak_beyond_seven', { days })
    : i18n.t('streak_of_seven', { days: target });

  return (
    <View style={styles.wrap} accessible accessibilityLabel={caption}>
      <View style={styles.panel}>
        <View style={styles.glow} pointerEvents="none">
          <TorchGlow size={GLOW_SIZE} color={COLORS.gold} strength={shown / LANTERN_SLOTS}>
            <View style={{ width: GLOW_SIZE, height: GLOW_SIZE }} />
          </TorchGlow>
        </View>
        <View style={styles.row}>
          {lit.map((value, i) => (
            i < shown ? (
              <Animated.View
                key={i}
                testID="flame-lit"
                style={[styles.slot, { opacity: Animated.multiply(value, flicker) }]}
              >
                <Icon name="fire" size={GLYPH} color={i === LANTERN_SLOTS - 1 ? COLORS.goldBright : COLORS.gold} />
              </Animated.View>
            ) : (
              <View key={i} testID="flame-unlit" style={styles.slot}>
                <Icon name="fire" size={GLYPH} color={COLORS.brassDark} style={styles.wick} />
              </View>
            )
          ))}
        </View>
      </View>
      <Text style={[styles.caption, days >= LANTERN_SLOTS && styles.captionBurning]}>{caption}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  panel: {
    paddingHorizontal: PANEL_PAD_X,
    paddingVertical: SPACE.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.brass,
    backgroundColor: COLORS.panelDeep,
    overflow: 'hidden',
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ scaleX: GLOW_STRETCH }],
  },
  row: { flexDirection: 'row', gap: SLOT_GAP, width: ROW_WIDTH },
  slot: { width: SLOT, height: SLOT, alignItems: 'center', justifyContent: 'center' },
  wick: { opacity: 0.55 },
  caption: {
    marginTop: SPACE.sm,
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sm,
    color: COLORS.textDim,
  },
  captionBurning: { color: COLORS.gold },
});
