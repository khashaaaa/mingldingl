import { ReactNode, useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { useSharedValue, withRepeat, withTiming, useDerivedValue } from 'react-native-reanimated';
import { COLORS, tint } from '../../lib/theme';
import { useVfxLevel } from '../../lib/vfx';

interface Props {
  size: number;
  color?: string;
  /**
   * 0..1 scale on the whole glow, so a caller can carry a *ramp* rather than an on/off. 1 is the
   * torch as it has always burned; the gem badges pass `TIER_PRESENCE`'s normalised rank here so
   * the top of the ladder is unchanged and everything below it is proportionally dimmer.
   */
  strength?: number;
  children: ReactNode;
}

// Concatenating hex alpha onto the colour (`color + 'AA'`) silently produced garbage for any
// input that was not a 6-digit hex. Fading to a transparent version of the colour itself,
// rather than to transparent black, also avoids a grey fringe at the edge of the falloff.
const GLOW_STOPS = (color: string) => [tint(color, 0.67), tint(color, 0.13), tint(color, 0)];

/** The pulse the torch breathes between, before `strength` scales it. */
const PULSE_LOW = 0.45;
const PULSE_HIGH = 0.8;

export function TorchGlow({ size, color = COLORS.gold, strength = 1, children }: Props) {
  const level = useVfxLevel();
  // A glow scaled to nothing is not a faint glow, it is a Canvas and a loop burning frames to
  // draw zero pixels. Rank 0 renders the bare child.
  if (strength <= 0) return <>{children}</>;
  if (level === 'off') return <>{children}</>;
  if (level === 'full') return <SkiaGlow size={size} color={color} strength={strength}>{children}</SkiaGlow>;
  // A glow has a still form — it is a light, not a movement — so `still` keeps it and only stops
  // the breathing, holding at the midpoint of the pulse it would otherwise run.
  return <ShadowGlow color={color} strength={strength} animate={level === 'plain'}>{children}</ShadowGlow>;
}

function SkiaGlow({ size, color, strength, children }: Required<Props>) {
  const canvas = size * 1.8;
  const pulse = useSharedValue(PULSE_LOW * strength);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(PULSE_HIGH * strength, { duration: 1500 }), -1, true);
  }, [strength]);
  const opacity = useDerivedValue(() => pulse.value);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas pointerEvents="none" style={[StyleSheet.absoluteFillObject, { left: -(canvas - size) / 2, top: -(canvas - size) / 2, width: canvas, height: canvas }]}>
        <Circle cx={canvas / 2} cy={canvas / 2} r={canvas / 2} opacity={opacity}>
          <RadialGradient c={vec(canvas / 2, canvas / 2)} r={canvas / 2} colors={GLOW_STOPS(color)} />
        </Circle>
      </Canvas>
      {children}
    </View>
  );
}

function ShadowGlow(
  { color, strength, animate, children }:
  { color: string; strength: number; animate: boolean; children: ReactNode },
) {
  const torch = useRef(new Animated.Value(PULSE_LOW * strength)).current;
  useEffect(() => {
    if (!animate) {
      torch.setValue(((PULSE_LOW + PULSE_HIGH) / 2) * strength);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(torch, { toValue: 0.75 * strength, duration: 1500, useNativeDriver: false }),
      Animated.timing(torch, { toValue: PULSE_LOW * strength, duration: 1500, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [strength, animate, torch]);
  return (
    <Animated.View style={{ shadowColor: color, shadowOpacity: torch, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 8 }}>
      {children}
    </Animated.View>
  );
}
