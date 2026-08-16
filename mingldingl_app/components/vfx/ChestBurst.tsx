import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { useSharedValue, withTiming, useDerivedValue, Easing, SharedValue } from 'react-native-reanimated';
import { COLORS } from '../../lib/theme';
import { useVfxLevel } from '../../lib/vfx';

interface Props { size: number; trigger: number; }   // bump `trigger` to fire

interface P { angle: number; speed: number; r: number; color: string; coin: boolean; }

export function ChestBurst({ size, trigger }: Props) {
  const level = useVfxLevel();
  // The level check must gate whether Reanimated/Skia hooks are ever called
  // at all, not just whether their JSX renders — a hook executing on a
  // platform where full-tier VFX isn't supported (web) throws, regardless of
  // what's returned afterwards. Isolating them in this sub-component means
  // React never invokes it, and therefore never calls the hooks, off web.
  if (level !== 'full' || trigger === 0) return null;
  return <SkiaChestBurst size={size} trigger={trigger} />;
}

function SkiaChestBurst({ size, trigger }: Required<Props>) {
  const particles = useMemo<P[]>(
    // A minority render as coins (filled disc + rim stroke) rather than plain
    // sparks — a chest bursting open should throw a little loot, not just light.
    () => Array.from({ length: 24 }).map(() => {
      const coin = Math.random() < 0.25;
      return {
        angle: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.6,
        r: coin ? 3 + Math.random() * 1.5 : 1.5 + Math.random() * 2.5,
        color: Math.random() < 0.7 ? COLORS.goldBright : COLORS.ember,
        coin,
      };
    }),
    [trigger],
  );
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) });
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
