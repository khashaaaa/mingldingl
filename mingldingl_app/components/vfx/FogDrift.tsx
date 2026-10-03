import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { BlurStyle, Canvas, Group, Image, Skia, type SkImage } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { cancelAnimation, useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming, Easing } from 'react-native-reanimated';
import { INK, tint } from '../../lib/theme';
import { useVfxLevel } from '../../lib/vfx';

interface Props {
  width: number; height: number;
  /** Holds the haze where it is: no frames drawn until it clears. */
  paused?: boolean;
}

const DRIFT_MS = 14000;
const HAZE = 0.07;

/**
 * Unlike the embers, fog has a still form — a haze is a thing even when it is not moving — so
 * `still` keeps it and merely stops it drifting. `plain` swaps Skia's blurred circles for soft
 * radial gradients, which is the closest a browser gets without a canvas.
 */
export function FogDrift({ width, height, paused = false }: Props) {
  const level = useVfxLevel();
  if (width === 0 || height === 0 || level === 'off') return null;
  if (level === 'full') return <SkiaFogDrift width={width} height={height} paused={paused} />;
  return <PlainFogDrift width={width} height={height} animate={level === 'plain'} />;
}

/** How far past its radius a bank's blur reaches; the bank's image is padded by this. */
const BLUR = 40;
const BLUR_REACH = BLUR * 3;
/**
 * The banks are baked at a quarter of their size and drawn scaled up: a blur has no detail to
 * lose, and a quarter-size image is a sixteenth of the memory and of the pixels to sample.
 */
const BAKE_SCALE = 0.25;

/**
 * One fog bank blurred once into an image. Null when no offscreen surface can be made, in which
 * case the bank is simply not drawn — fog is atmosphere, never information.
 */
function bakeBank(r: number): SkImage | null {
  const side = Math.max(1, Math.ceil((r + BLUR_REACH) * 2 * BAKE_SCALE));
  const surface = Skia.Surface.MakeOffscreen(side, side);
  if (!surface) return null;
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(INK.dim));
  paint.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, BLUR * BAKE_SCALE, true));
  surface.getCanvas().drawCircle(side / 2, side / 2, r * BAKE_SCALE, paint);
  surface.flush();
  // A raster copy: the snapshot lives on this thread's GPU context, and the canvas draws on another.
  return surface.makeImageSnapshot().makeNonTextureImage();
}

/**
 * Each bank is blurred once, at mount, and every frame of the drift only moves the finished image.
 * It used to re-blur both banks on every frame, which cost the Deep about 9ms of render thread per
 * frame on the Galaxy A51 (2026-10-03) for a haze that crosses the screen once in fourteen seconds.
 */
function SkiaFogDrift({ width, height, paused = false }: Props) {
  const t = useSharedValue(0);
  useEffect(() => {
    if (paused) {
      cancelAnimation(t);
      return;
    }
    // Out to the far bank at the remaining share of a pass, then the usual back-and-forth from
    // there — a reversing `withRepeat` started mid-pass would swing between here and 1 forever.
    const ease = Easing.inOut(Easing.quad);
    t.value = withSequence(
      withTiming(1, { duration: DRIFT_MS * Math.max(0, 1 - t.value), easing: ease }),
      withRepeat(withTiming(0, { duration: DRIFT_MS, easing: ease }), -1, true),
    );
  }, [t, paused]);

  const r1 = width * 0.3;
  const r2 = width * 0.25;
  const banks = useMemo(() => ({ one: bakeBank(r1), two: bakeBank(r2) }), [r1, r2]);
  const half1 = r1 + BLUR_REACH;
  const half2 = r2 + BLUR_REACH;
  const x1 = useDerivedValue(() => width * 0.25 + t.value * width * 0.5 - half1);
  const x2 = useDerivedValue(() => width * 0.75 - t.value * width * 0.5 - half2);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Canvas style={{ width, height }}>
        <Group opacity={HAZE}>
          {banks.one && <Image image={banks.one} x={x1} y={height * 0.4 - half1} width={half1 * 2} height={half1 * 2} fit="fill" />}
          {banks.two && <Image image={banks.two} x={x2} y={height * 0.65 - half2} width={half2 * 2} height={half2 * 2} fit="fill" />}
        </Group>
      </Canvas>
    </View>
  );
}

function PlainFogDrift({ width, height, animate }: Props & { animate: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!animate) {
      t.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: DRIFT_MS, useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: DRIFT_MS, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, t]);

  const travel = width * 0.5;
  const bank = (r: number, cy: number, from: number, to: number) => (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: -r,
        top: cy - r,
        width: r * 2,
        height: r * 2,
        borderRadius: r,
        overflow: 'hidden',
        opacity: HAZE,
        transform: [{ translateX: t.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) }],
      }}
    >
      {/* expo-linear-gradient has no radial mode, so the falloff is a vertical fade inside a
          circular clip — soft enough at 7% opacity that the difference is not visible. */}
      <LinearGradient
        colors={[tint(INK.dim, 0.9), tint(INK.dim, 0.35), tint(INK.dim, 0)]}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {bank(width * 0.3, height * 0.4, width * 0.25, width * 0.25 + travel)}
      {bank(width * 0.25, height * 0.65, width * 0.75, width * 0.75 - travel)}
    </View>
  );
}
