import { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, useDerivedValue, Easing, SharedValue } from 'react-native-reanimated';
import { COLORS } from '../../lib/theme';
import { useVfxLevel } from '../../lib/vfx';

interface Props { size: number; trigger: number; }

interface P { angle: number; speed: number; r: number; color: string; coin: boolean; }

const BURST_MS = 900;

function configure(count: number): P[] {
  return Array.from({ length: count }).map(() => {
    const coin = Math.random() < 0.25;
    return {
      angle: Math.random() * Math.PI * 2,
      speed: 0.4 + Math.random() * 0.6,
      r: coin ? 3 + Math.random() * 1.5 : 1.5 + Math.random() * 2.5,
      color: Math.random() < 0.7 ? COLORS.goldBright : COLORS.ember,
      coin,
    };
  });
}

/**
 * A burst is an event, not a state: there is nothing to render once it is not moving, so `still`
 * draws nothing. `plain` throws half as many particles as plain views, because a browser opening
 * a chest should still see it open.
 */
export function ChestBurst({ size, trigger }: Props) {
  const level = useVfxLevel();
  if (trigger === 0) return null;
  if (level === 'full') return <SkiaChestBurst size={size} trigger={trigger} count={24} />;
  if (level === 'plain') return <PlainChestBurst size={size} trigger={trigger} count={12} />;
  return null;
}

interface BurstProps extends Props { count: number; }

function SkiaChestBurst({ size, trigger, count }: BurstProps) {
  const particles = useMemo<P[]>(() => configure(count), [trigger, count]);
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: BURST_MS, easing: Easing.out(Easing.quad) });
  }, [trigger]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
      <Canvas style={{ width: size, height: size }}>
        {particles.map((p, i) => <Particle key={`${trigger}-${i}`} p={p} size={size} progress={progress} />)}
      </Canvas>
    </View>
  );
}

function Particle({ p, size, progress }: { p: P; size: number; progress: SharedValue<number> }) {
  const cx = useDerivedValue(() => size / 2 + Math.cos(p.angle) * progress.value * (size / 2) * p.speed);
  const cy = useDerivedValue(() => size / 2 + Math.sin(p.angle) * progress.value * (size / 2) * p.speed + progress.value * progress.value * 20);
  const opacity = useDerivedValue(() => 1 - progress.value);
  if (p.coin) {
    return (
      <>
        <Circle cx={cx} cy={cy} r={p.r} color={p.color} opacity={opacity} />
        <Circle cx={cx} cy={cy} r={p.r * 0.6} color={COLORS.panelDeep} style="stroke" strokeWidth={0.6} opacity={opacity} />
      </>
    );
  }
  return <Circle cx={cx} cy={cy} r={p.r} color={p.color} opacity={opacity} />;
}

function PlainChestBurst({ size, trigger, count }: BurstProps) {
  const particles = useMemo<P[]>(() => configure(count), [trigger, count]);
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, { toValue: 1, duration: BURST_MS, useNativeDriver: true }).start();
  }, [trigger, progress]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { alignItems: 'center', justifyContent: 'center' }]}>
      <View style={{ width: size, height: size }}>
        {particles.map((p, i) => (
          <Animated.View
            key={`${trigger}-${i}`}
            style={{
              position: 'absolute',
              left: size / 2 - p.r,
              top: size / 2 - p.r,
              width: p.r * 2,
              height: p.r * 2,
              borderRadius: p.r,
              backgroundColor: p.color,
              // Gravity is the `progress²` term on the Skia path; two stops approximate the sag.
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(p.angle) * (size / 2) * p.speed] }) },
                { translateY: progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, Math.sin(p.angle) * (size / 4) * p.speed + 5, Math.sin(p.angle) * (size / 2) * p.speed + 20] }) },
              ],
              opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
            }}
          />
        ))}
      </View>
    </View>
  );
}
