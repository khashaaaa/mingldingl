import { Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import {
  cancelAnimation,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { withAlpha } from '../effects';
import { curve, MOTION, useReduceMotion } from '../motion';

/**
 * Warm light behind a held flame or a fresh seal (gems and fire are the only things that shine):
 * a soft radial glow that fades in, then breathes with the candle. Sits behind its sibling art;
 * the parent sizes it (absolute fill).
 */
export function Glow({
  tint,
  strength = 0.5,
  breathe = true,
}: {
  tint: string;
  strength?: number;
  breathe?: boolean;
}) {
  const reduce = useReduceMotion();
  const m = MOTION.candle;
  const size = useSharedValue({ width: 0, height: 0 });
  const k = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) return;
    const ease = curve(m.easing);
    k.value = breathe
      ? withSequence(
          withTiming(1, { duration: MOTION.inkBleedIn.duration * 2, easing: ease }),
          withRepeat(withTiming(0.7, { duration: m.duration / 2, easing: ease }), -1, true),
        )
      : withTiming(1, { duration: MOTION.inkBleedIn.duration * 2, easing: ease });
    return () => cancelAnimation(k);
  }, [k, reduce, breathe]);
  const c = useDerivedValue(() => vec(size.value.width / 2, size.value.height / 2));
  const r = useDerivedValue(
    () => (Math.min(size.value.width, size.value.height) / 2) * (0.85 + 0.15 * k.value),
  );
  const opacity = useDerivedValue(() => k.value);
  return (
    <Canvas pointerEvents="none" style={StyleSheet.absoluteFill} onSize={size}>
      <Circle c={c} r={r} opacity={opacity}>
        <RadialGradient
          c={c}
          r={r}
          colors={[withAlpha(tint, strength), withAlpha(tint, strength * 0.35), withAlpha(tint, 0)]}
          positions={[0, 0.45, 1]}
        />
      </Circle>
    </Canvas>
  );
}
