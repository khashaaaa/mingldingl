import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { BlurMask, Canvas, Circle, Line, vec } from '@shopify/react-native-skia';
import { cancelAnimation, interpolateColor, useSharedValue, withRepeat, withSequence, withTiming, withDelay, useDerivedValue, Easing } from 'react-native-reanimated';
import { ACCENT, HEAT, METAL } from '../../lib/theme';
import { useVfxLevel } from '../../lib/vfx';

interface Props {
  width: number; height: number; density?: number;
  /** Holds every ember where it is: no frames drawn, no animation callbacks, until it clears. */
  paused?: boolean;
}

interface EmberCfg {
  x: number; drift: number; r: number; duration: number; delay: number; color: string;
  /** How far up the band it is thrown before the air takes it, 0..1. */
  reach: number;
  /** A second, faster sway on top of the first: the flutter of a spark on rising heat. */
  flutter: number; phase: number;
  /** A spit: small, fast, short-lived, flung off the fire rather than carried up by it. */
  spit: boolean;
}

function configure(width: number, density: number): EmberCfg[] {
  // Each slot is one spark or one spit; about a third of them spit.
  return Array.from({ length: density }).map((_, i) => {
    const spit = Math.random() < 0.34;
    return {
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * (spit ? 60 : 36),
      r: spit ? 1.1 + Math.random() * 0.7 : 1.7 + Math.random() * 1.6,
      duration: spit ? 1100 + Math.random() * 900 : 2600 + Math.random() * 2400,
      delay: (i / density) * 2600,
      color: Math.random() < 0.6 ? METAL.gold : METAL.ember,
      reach: spit ? 0.35 + Math.random() * 0.35 : 0.75 + Math.random() * 0.25,
      flutter: 3 + Math.random() * 4,
      phase: Math.random() * Math.PI * 2,
      spit,
    };
  });
}

/**
 * An ember field is nothing but motion — a still ember is a speck of dust, not a dim ember — so
 * `still` renders nothing at all. `plain` (web, where no Skia canvas can mount) gets the same
 * field drawn as plain views at half the density, which is what the browser can carry without a
 * canvas and is why this layer is no longer invisible during development.
 */
export function EmberField({ width, height, density = 6, paused = false }: Props) {
  const level = useVfxLevel();
  if (width === 0 || height === 0) return null;
  if (level === 'full') return <SkiaEmbers width={width} height={height} density={density} paused={paused} />;
  if (level === 'plain') return <PlainEmbers width={width} height={height} density={Math.max(3, Math.round(density / 2))} />;
  return null;
}

function SkiaEmbers({ width, height, density, paused }: Required<Props>) {
  // Re-rolled whenever the canvas changes shape. `height` is not a spawn input, so it is read
  // here to make that intent a real dependency; it is never 0 by the time this mounts.
  const embers = useMemo(() => (height > 0 ? configure(width, density) : []), [width, height, density]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Canvas style={{ width, height }}>
        {embers.map((cfg, i) => <Ember key={i} cfg={cfg} height={height} paused={paused} />)}
      </Canvas>
    </View>
  );
}

function Ember({ cfg, height, paused }: { cfg: EmberCfg; height: number; paused: boolean }) {
  const progress = useSharedValue(0);
  const started = useRef(false);
  useEffect(() => {
    if (paused) {
      cancelAnimation(progress);
      return;
    }
    const climb = withTiming(1, { duration: cfg.duration, easing: Easing.linear });
    if (!started.current) {
      started.current = true;
      progress.value = withDelay(cfg.delay, withRepeat(climb, -1, false));
      return;
    }
    // Resuming mid-climb: finish this climb at the same speed, then loop from the floor. A plain
    // `withRepeat` here would loop from wherever the pause left it, and the ember would only ever
    // rise through the top of the band again.
    const left = Math.max(0, 1 - progress.value);
    progress.value = withSequence(
      withTiming(1, { duration: cfg.duration * left, easing: Easing.linear }),
      withRepeat(withSequence(withTiming(0, { duration: 0 }), climb), -1, false),
    );
    // A re-rolled cfg moves the ember, it does not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, paused]);

  // Thrown up hard and slowed by the air: the climb eases out, so a spark leaves the fire fast and
  // hangs at the top of its throw while it cools.
  const at = (p: number) => {
    'worklet';
    const rise = 1 - Math.pow(1 - p, 2.2);
    return {
      x: cfg.x + Math.sin(p * Math.PI * 2 + cfg.phase) * cfg.drift * Math.sqrt(p) + Math.sin(p * Math.PI * 2 * cfg.flutter + cfg.phase) * 6 * Math.sqrt(p),
      y: height - rise * cfg.reach * height,
    };
  };
  const head = useDerivedValue(() => { const q = at(progress.value); return vec(q.x, q.y); });
  // The streak: where the spark was a moment ago. Long while it is fast, gone once it hangs.
  const tail = useDerivedValue(() => { const q = at(Math.max(0, progress.value - (cfg.spit ? 0.016 : 0.008))); return vec(q.x, q.y); });
  // White-hot as it leaves, cooling through gold to its own ember colour, then dark.
  const color = useDerivedValue(() =>
    interpolateColor(progress.value, [0, 0.18, 0.55, 1], [HEAT.spark, ACCENT.bright, cfg.color, METAL.emberDeep]),
  );
  // The core runs a step hotter than the streak behind it.
  const core = useDerivedValue(() =>
    interpolateColor(progress.value * 0.6, [0, 0.18, 0.55, 1], [HEAT.spark, ACCENT.bright, cfg.color, METAL.emberDeep]),
  );
  const opacity = useDerivedValue(() => {
    const p = progress.value;
    const life = p < 0.06 ? p / 0.06 : Math.pow(1 - p, 0.8);
    // Flicker: a spark burns unevenly as it tumbles.
    return life * (0.72 + 0.28 * Math.sin(p * 61 + cfg.phase));
  });
  const r = useDerivedValue(() => cfg.r * (1 - 0.55 * progress.value));
  const trail = useDerivedValue(() => r.value * 0.8);
  const glowR = useDerivedValue(() => r.value * 4.5);
  const glowOpacity = useDerivedValue(() => opacity.value * 0.6);
  return (
    <>
      {!cfg.spit && (
        <Circle c={head} r={glowR} color={color} opacity={glowOpacity}>
          <BlurMask blur={6} style="normal" />
        </Circle>
      )}
      <Line p1={tail} p2={head} color={color} opacity={opacity} strokeWidth={trail} strokeCap="round" style="stroke" />
      <Circle c={head} r={r} color={core} opacity={opacity} />
    </>
  );
}

function PlainEmbers({ width, height, density }: Required<Omit<Props, 'paused'>>) {
  // Re-rolled whenever the canvas changes shape. `height` is not a spawn input, so it is read
  // here to make that intent a real dependency; it is never 0 by the time this mounts.
  const embers = useMemo(() => (height > 0 ? configure(width, density) : []), [width, height, density]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      {embers.map((cfg, i) => <PlainEmber key={i} cfg={cfg} height={height} />)}
    </View>
  );
}

function PlainEmber({ cfg, height }: { cfg: EmberCfg; height: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(cfg.delay),
        Animated.timing(progress, { toValue: 1, duration: cfg.duration, easing: (t) => t, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [cfg, progress]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: cfg.x,
        bottom: 0,
        width: cfg.r * 2,
        height: cfg.r * 2,
        borderRadius: cfg.r,
        backgroundColor: cfg.color,
        // The sine drift the Skia ember gets per frame is approximated with three stops: one
        // interpolation cannot be a sine, and a browser does not need it to be.
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -height] }) },
          { translateX: progress.interpolate({ inputRange: [0, 0.25, 0.75, 1], outputRange: [0, cfg.drift, -cfg.drift, 0] }) },
        ],
        opacity: progress.interpolate({ inputRange: [0, 0.1, 1], outputRange: [0, 0.6, 0] }),
      }}
    />
  );
}
