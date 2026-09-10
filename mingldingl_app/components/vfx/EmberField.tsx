import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { useSharedValue, withRepeat, withTiming, withDelay, useDerivedValue, Easing } from 'react-native-reanimated';
import { COLORS } from '../../lib/theme';
import { useVfxLevel } from '../../lib/vfx';

interface Props { width: number; height: number; density?: number; }

interface EmberCfg { x: number; drift: number; r: number; duration: number; delay: number; color: string; }

function configure(width: number, density: number): EmberCfg[] {
  return Array.from({ length: density }).map((_, i) => ({
    x: Math.random() * width,
    drift: (Math.random() - 0.5) * 30,
    r: 1.5 + Math.random() * 1.8,
    duration: 3500 + Math.random() * 3000,
    delay: (i / density) * 3000,
    color: Math.random() < 0.6 ? COLORS.gold : COLORS.ember,
  }));
}

/**
 * An ember field is nothing but motion — a still ember is a speck of dust, not a dim ember — so
 * `still` renders nothing at all. `plain` (web, where no Skia canvas can mount) gets the same
 * field drawn as plain views at half the density, which is what the browser can carry without a
 * canvas and is why this layer is no longer invisible during development.
 */
export function EmberField({ width, height, density = 8 }: Props) {
  const level = useVfxLevel();
  if (width === 0 || height === 0) return null;
  if (level === 'full') return <SkiaEmbers width={width} height={height} density={density} />;
  if (level === 'plain') return <PlainEmbers width={width} height={height} density={Math.max(3, Math.round(density / 2))} />;
  return null;
}

function SkiaEmbers({ width, height, density }: Required<Props>) {
  const embers = useMemo(() => configure(width, density), [width, height, density]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Canvas style={{ width, height }}>
        {embers.map((cfg, i) => <Ember key={i} cfg={cfg} height={height} />)}
      </Canvas>
    </View>
  );
}

function Ember({ cfg, height }: { cfg: EmberCfg; height: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(cfg.delay, withRepeat(withTiming(1, { duration: cfg.duration, easing: Easing.linear }), -1, false));
  }, []);
  const cy = useDerivedValue(() => height - progress.value * height);
  const cx = useDerivedValue(() => cfg.x + Math.sin(progress.value * Math.PI * 2) * cfg.drift);
  const opacity = useDerivedValue(() => (progress.value < 0.1 ? progress.value * 6 : (1 - progress.value) * 0.7));
  return <Circle cx={cx} cy={cy} r={cfg.r} color={cfg.color} opacity={opacity} />;
}

function PlainEmbers({ width, height, density }: Required<Props>) {
  const embers = useMemo(() => configure(width, density), [width, height, density]);
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
