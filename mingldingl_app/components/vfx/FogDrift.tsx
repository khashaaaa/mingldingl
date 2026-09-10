import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Canvas, Circle, Blur, Group } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { useSharedValue, withRepeat, withTiming, useDerivedValue, Easing } from 'react-native-reanimated';
import { COLORS, tint } from '../../lib/theme';
import { useVfxLevel } from '../../lib/vfx';

interface Props { width: number; height: number; }

const DRIFT_MS = 14000;
const HAZE = 0.07;

/**
 * Unlike the embers, fog has a still form — a haze is a thing even when it is not moving — so
 * `still` keeps it and merely stops it drifting. `plain` swaps Skia's blurred circles for soft
 * radial gradients, which is the closest a browser gets without a canvas.
 */
export function FogDrift({ width, height }: Props) {
  const level = useVfxLevel();
  if (width === 0 || height === 0 || level === 'off') return null;
  if (level === 'full') return <SkiaFogDrift width={width} height={height} />;
  return <PlainFogDrift width={width} height={height} animate={level === 'plain'} />;
}

function SkiaFogDrift({ width, height }: Props) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withRepeat(withTiming(1, { duration: DRIFT_MS, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, []);
  const cx1 = useDerivedValue(() => width * 0.25 + t.value * width * 0.5);
  const cx2 = useDerivedValue(() => width * 0.75 - t.value * width * 0.5);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
      <Canvas style={{ width, height }}>
        <Group opacity={HAZE}>
          <Circle cx={cx1} cy={height * 0.4} r={width * 0.3} color={COLORS.textDim}>
            <Blur blur={40} />
          </Circle>
          <Circle cx={cx2} cy={height * 0.65} r={width * 0.25} color={COLORS.textDim}>
            <Blur blur={40} />
          </Circle>
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
        colors={[tint(COLORS.textDim, 0.9), tint(COLORS.textDim, 0.35), tint(COLORS.textDim, 0)]}
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
