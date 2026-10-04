import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { METAL_IMAGES, STRAP } from '../ui/metal';
import { i18n } from '../../lib/i18n';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { LEADING, ACCENT, FONTS, FONT_SIZES, HEAT, INK, MATERIAL, METAL, RADIUS, SPACE, SURFACE, circle, glow, tint } from '../../lib/theme';
export type GateState = 'closed' | 'opening' | 'barred';

interface Props {
  state: GateState;
}

const HEIGHT = 140;
const OPEN_MS = 900;
/** Assumed width until `onLayout` reports the real one, so the first frame is never a half-open gate. */
const FALLBACK_WIDTH = 320;

const CAPTION: Record<GateState, 'gate_waiting' | 'gate_opening' | 'gate_barred'> = {
  closed: 'gate_waiting',
  opening: 'gate_opening',
  barred: 'gate_barred',
};

/**
 * The Gate. Phone verification is the one real wait in the app — the user texts the code and
 * the engine listens for verify.mn — and it used to be a spinner. Now it is a gate: shut while the
 * gatekeeper listens, swinging open the moment the word arrives, barred once the hour has passed.
 *
 * Reduce-motion (`still`) and the kill switch (`off`) render each state at rest: the open gate is
 * simply open. The caption changes with the state so the moment reads without the motion.
 */
export function GateScene({ state }: Props) {
  const level = useVfxLevel();
  const animate = motionAllowed(level);
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  const slide = useRef(new Animated.Value(0)).current;
  const light = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const target = state === 'opening' ? 1 : 0;
    if (!animate) {
      slide.setValue(target);
      light.setValue(target);
      return;
    }
    const run = Animated.parallel([
      Animated.timing(slide, {
        toValue: target,
        duration: OPEN_MS,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(light, {
        toValue: target,
        duration: OPEN_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    run.start();
    return () => run.stop();
  }, [state, animate, slide, light]);

  function onLayout(e: LayoutChangeEvent) {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && w !== width) setWidth(w);
  }

  const half = width / 2;
  const leftShift = slide.interpolate({ inputRange: [0, 1], outputRange: [0, -half] });
  const rightShift = slide.interpolate({ inputRange: [0, 1], outputRange: [0, half] });
  const glowOpacity = light.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });
  const glowScale = light.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] });

  return (
    <View style={styles.wrap}>
      <View style={styles.scene} onLayout={onLayout} testID={`gate-scene-${state}`}>
        {/* The light behind the gate — faint through the seam, flooding out as it opens. */}
        <Animated.View
          pointerEvents="none"
          style={[styles.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]}
        />
        <View pointerEvents="none" style={styles.seam} />

        <Animated.View style={[styles.half, styles.leftHalf, { transform: [{ translateX: leftShift }] }]}>
          <Leaf />
          <View style={[styles.stud, styles.studLeft]} pointerEvents="none" />
        </Animated.View>

        <Animated.View style={[styles.half, styles.rightHalf, { transform: [{ translateX: rightShift }] }]}>
          <Leaf mirrored />
          <View style={[styles.stud, styles.studRight]} pointerEvents="none" />
        </Animated.View>

        {state === 'barred' && (
          <View pointerEvents="none" style={styles.crossbar} testID="gate-crossbar">
            <View style={styles.crossbarEdge} />
          </View>
        )}
      </View>

      <Text style={styles.caption}>{i18n.t(CAPTION[state])}</Text>
    </View>
  );
}

/**
 * One leaf's ironwork: hammered grain over the boards and two riveted iron straps across them,
 * near the top and the foot, the way a real gate is bound. The right leaf mirrors the left so
 * the straps' rivets meet the seam the same way on both sides.
 */
function Leaf({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <View style={[StyleSheet.absoluteFill, styles.leafClip, mirrored && styles.mirrored]} pointerEvents="none">
      <Image source={METAL_IMAGES.grain[mirrored ? 1 : 0]} style={styles.leafGrain} resizeMode="cover" />
      {[styles.strapTop, styles.strapFoot].map((at, i) => (
        <View key={i} style={[styles.strap, at]}>
          <Image source={METAL_IMAGES.strap} style={styles.strapImg} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: SPACE.sm, alignItems: 'stretch' },
  scene: {
    height: HEIGHT,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: SURFACE.ground,
    borderWidth: 1,
    borderColor: METAL.brassDeep,
  },
  glow: {
    position: 'absolute',
    alignSelf: 'center',
    top: HEIGHT * 0.1,
    width: HEIGHT * 0.8,
    height: HEIGHT * 0.8,
    borderRadius: HEIGHT * 0.4,
    backgroundColor: tint(ACCENT.bright, 0.55),
    ...glow(ACCENT.bright, 0.9, 28, 0),
  },
  seam: {
    position: 'absolute',
    alignSelf: 'center',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: tint(ACCENT.bright, 0.35),
  },
  half: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '50%',
    backgroundColor: SURFACE.sunken,
    borderColor: METAL.brass,
  },
  leftHalf: { left: 0, borderRightWidth: 2 },
  rightHalf: { right: 0, borderLeftWidth: 2 },
  leafClip: { overflow: 'hidden' },
  mirrored: { transform: [{ scaleX: -1 }] },
  leafGrain: { ...StyleSheet.absoluteFillObject, width: undefined, height: undefined, opacity: 0.6 },
  strap: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: STRAP.height,
    overflow: 'hidden',
    backgroundColor: MATERIAL.iron,
  },
  strapTop: { top: SPACE.lg },
  strapFoot: { bottom: SPACE.lg },
  strapImg: { position: 'absolute', left: 0, top: 0, width: STRAP.width, height: STRAP.height },
  // The ring-pull, one per leaf, sitting where a hand would reach for it.
  stud: {
    position: 'absolute',
    top: HEIGHT / 2 - 7,
    ...circle(14),
    backgroundColor: METAL.brassDeep,
    borderWidth: 1.5,
    borderColor: METAL.brass,
  },
  studLeft: { right: SPACE.lg },
  studRight: { left: SPACE.lg },
  crossbar: {
    position: 'absolute',
    top: HEIGHT / 2 - 8,
    left: -SPACE.lg,
    right: -SPACE.lg,
    height: 16,
    backgroundColor: HEAT.flame,
    borderRadius: RADIUS.sm,
    transform: [{ rotate: '-4deg' }],
    ...glow(HEAT.flame, 0.6, 10, 4),
  },
  crossbarEdge: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    height: 4,
    backgroundColor: METAL.emberDeep,
    borderBottomLeftRadius: RADIUS.sm,
    borderBottomRightRadius: RADIUS.sm,
  },
  caption: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.md,
    lineHeight: LEADING.md,
    color: INK.dim,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
