import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Canvas, Circle } from '@shopify/react-native-skia';
import { useSharedValue, withRepeat, withTiming, withDelay, useDerivedValue, Easing } from 'react-native-reanimated';
import { COLORS } from '../../lib/theme';
import { useVfxLevel } from '../../lib/vfx';

interface Props { width: number; height: number; density?: number; }

interface EmberCfg { x: number; drift: number; r: number; duration: number; delay: number; color: string; }

export function EmberField({ width, height, density = 8 }: Props) {
  const level = useVfxLevel();
  const embers = useMemo<EmberCfg[]>(
    () => Array.from({ length: density }).map((_, i) => ({
      x: Math.random() * width,
      drift: (Math.random() - 0.5) * 30,
      r: 1.5 + Math.random() * 1.8,
      duration: 3500 + Math.random() * 3000,
      delay: (i / density) * 3000,
      color: Math.random() < 0.6 ? COLORS.gold : COLORS.ember,
    })),
    [width, height, density],
  );
  if (level !== 'full' || width === 0 || height === 0) return null;
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
