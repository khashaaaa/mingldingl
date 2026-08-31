import { ReactNode, useEffect, useRef } from 'react';
import { Animated, View, StyleSheet } from 'react-native';
import { Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { useSharedValue, withRepeat, withTiming, useDerivedValue } from 'react-native-reanimated';
import { COLORS } from '../../lib/theme';
import { useVfxLevel } from '../../lib/vfx';

interface Props { size: number; color?: string; children: ReactNode; }

export function TorchGlow({ size, color = COLORS.gold, children }: Props) {
  const level = useVfxLevel();
  if (level === 'full') return <SkiaGlow size={size} color={color}>{children}</SkiaGlow>;
  if (level === 'reduced') return <ShadowGlow color={color}>{children}</ShadowGlow>;
  return <>{children}</>;
}

function SkiaGlow({ size, color, children }: Required<Props>) {
  const canvas = size * 1.8;
  const pulse = useSharedValue(0.45);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.8, { duration: 1500 }), -1, true);
  }, []);
  const opacity = useDerivedValue(() => pulse.value);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas pointerEvents="none" style={[StyleSheet.absoluteFillObject, { left: -(canvas - size) / 2, top: -(canvas - size) / 2, width: canvas, height: canvas }]}>
        <Circle cx={canvas / 2} cy={canvas / 2} r={canvas / 2} opacity={opacity}>
          <RadialGradient c={vec(canvas / 2, canvas / 2)} r={canvas / 2} colors={[color + 'AA', color + '22', '#00000000']} />
        </Circle>
      </Canvas>
      {children}
    </View>
  );
}

function ShadowGlow({ color, children }: { color: string; children: ReactNode }) {
  const torch = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(torch, { toValue: 0.75, duration: 1500, useNativeDriver: false }),
      Animated.timing(torch, { toValue: 0.45, duration: 1500, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View style={{ shadowColor: color, shadowOpacity: torch, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 8 }}>
      {children}
    </Animated.View>
  );
}
