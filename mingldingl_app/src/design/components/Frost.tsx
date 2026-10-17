import { Canvas, Fill, ImageShader, Shader, Skia, useImage } from '@shopify/react-native-skia';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useDerivedValue, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { ART } from '../art/manifest';
import { MOTION, useReduceMotion } from '../motion';

/**
 * Frost creeping in from the edges of the screen along a ragged, crystalline front, with a faint
 * bright rim where it is still growing. 0 → 1 is how far in it has crept.
 */
const CREEP = Skia.RuntimeEffect.Make(`
uniform shader image;
uniform float2 size;
uniform float progress;
uniform float opacity;

float hash(float2 p) { return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453); }
float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + float2(1, 0)), u.x), mix(hash(i + float2(0, 1)), hash(i + float2(1, 1)), u.x), u.y);
}

half4 main(float2 p) {
  float2 uv = p / size;
  // 0 at the screen's edge, 1 at its centre.
  float edge = min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)) * 2.0;
  float n = noise(p / 38.0) * 0.6 + noise(p / 11.0) * 0.4;
  float v = edge + (n - 0.5) * 0.4;
  float front = progress * 1.3;
  float a = 1.0 - smoothstep(front - 0.07, front, v);
  float rim = smoothstep(front - 0.07, front - 0.02, v) * a * (1.0 - progress);
  return image.eval(p) * (a * opacity) + half4(rim * 0.3 * opacity);
}
`);

/** The frost over a cold bond or the Frozen Gate (Figma motion "Frost creep"); fills its parent. */
export function Frost({ opacity, delay = 0 }: { opacity: number; delay?: number }) {
  const reduce = useReduceMotion();
  const image = useImage(ART.frost_full);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const k = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce || !image) return;
    k.value = withDelay(delay, withTiming(1, { duration: MOTION.frostCreep.duration * 1.5 }));
  }, [k, reduce, image, delay]);
  const uniforms = useDerivedValue(() => ({
    size: [size?.width ?? 1, size?.height ?? 1],
    progress: k.value,
    opacity,
  }));
  return (
    <View
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {size && image && CREEP && (
        <Canvas style={StyleSheet.absoluteFill}>
          <Fill>
            <Shader source={CREEP} uniforms={uniforms}>
              <ImageShader image={image} fit="cover" rect={{ x: 0, y: 0, ...size }} />
            </Shader>
          </Fill>
        </Canvas>
      )}
    </View>
  );
}
