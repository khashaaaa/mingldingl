import {
  BlurMask,
  Canvas,
  Circle,
  Group,
  Image,
  LinearGradient,
  Rect,
  useImage,
  vec,
} from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, useWindowDimensions } from 'react-native';
import {
  Easing,
  type SharedValue,
  useDerivedValue,
  useFrameCallback,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ART } from '../art/manifest';
import floor from '../figma/world-floor.json';
import { useReduceMotion } from '../motion';
import { duration, easing } from '../tokens';
import type { Fire, Sky } from './rooms';
import { SPARKS_FOR, type Spark, sparkAt, sparkField } from './sparks';

const FRAME_W = floor.frame[0] as number;
const FRAME_H = floor.frame[1] as number;

type Moon = { x: number; y: number; size: number; color: string; opacity: number; blur: number };
type Horizon = { y: number; h: number; color: string; from: number; to: number };

/** "#rrggbb" at an alpha, for a gradient stop that fades out. */
const alpha = (hex: string, a: number) =>
  `${hex}${Math.round(a * 255)
    .toString(16)
    .padStart(2, '0')}`;
const GLOW_OPACITY = { min: 0.81, max: 0.99 }; // breathing ±10% around 0.9

/**
 * The one floor under every screen (screens are transparent): night sky, stars, and the ember —
 * a hidden fire's glow breathing at the foot, its sparks each a live particle on the UI thread.
 * Stops when the app is in the background or Reduce Motion is on (the glow then holds still).
 */
export function WorldFloor({ fire, sky }: { fire: Fire; sky?: Sky | null }) {
  const gradient = (sky && (floor.seasons as Record<string, typeof floor.gradient>)[sky]) || floor.gradient;
  const { width, height } = useWindowDimensions();
  const reduced = useReduceMotion();
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => setActive(s === 'active'));
    return () => sub.remove();
  }, []);
  const animate = active && !reduced;

  const sx = width / FRAME_W;
  const moon = sky ? (floor.moon as Record<string, Moon | undefined>)[sky] : undefined;
  const horizon = sky ? (floor.horizon as Record<string, Horizon | undefined>)[sky] : undefined;
  const glowImg = useImage(fire === 'Roaring' ? ART.ember_glow_roaring : ART.ember_glow_lit);
  const glowH = floor.ember.glow.h * sx;
  const bandH = floor.ember.sparksBand.h * sx;

  const clock = useSharedValue(0);
  const frame = useFrameCallback((f) => {
    clock.value = f.timeSinceFirstFrame;
  }, false);
  useEffect(() => {
    frame.setActive(animate && fire !== 'Out');
  }, [animate, fire, frame]);

  const breath = useSharedValue(GLOW_OPACITY.max);
  useEffect(() => {
    if (!animate) {
      breath.value = GLOW_OPACITY.max;
      return;
    }
    const [x1, y1, x2, y2] = easing.breathe;
    breath.value = GLOW_OPACITY.min;
    breath.value = withRepeat(
      withTiming(GLOW_OPACITY.max, { duration: duration.loopMax / 2, easing: Easing.bezier(x1, y1, x2, y2) }),
      -1,
      true,
    );
  }, [animate, breath]);

  const sparks = useMemo(
    () => sparkField(11, animate ? SPARKS_FOR[fire] : 0, width, bandH),
    [animate, fire, width, bandH],
  );

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(0, height)}
          colors={gradient.map((g) => g.color)}
          positions={gradient.map((g) => g.at)}
        />
      </Rect>
      {/* A season's own sky (Figma's World Floor variants): the masked night's ember moon, Naadam's dusk */}
      {moon && (
        <Circle
          cx={(moon.x + moon.size / 2) * sx}
          cy={(moon.y + moon.size / 2) * sx}
          r={(moon.size / 2) * sx}
          color={moon.color}
          opacity={moon.opacity}
        >
          <BlurMask blur={moon.blur} style="normal" />
        </Circle>
      )}
      {horizon && (
        // Anchored to the foot, like the ember: the frame's distance from the bottom, scaled.
        <Rect x={0} y={height - (FRAME_H - horizon.y) * sx} width={width} height={horizon.h * sx} opacity={1}>
          <LinearGradient
            start={vec(0, height - (FRAME_H - horizon.y) * sx)}
            end={vec(0, height - (FRAME_H - horizon.y - horizon.h) * sx)}
            colors={[alpha(horizon.color, horizon.from), alpha(horizon.color, horizon.to)]}
          />
        </Rect>
      )}
      <Group>
        {floor.star.stars.map((s) => (
          <Circle
            key={`${s.x}-${s.y}`}
            cx={s.x * sx}
            cy={s.y * sx}
            r={(s.size * sx) / 2}
            color={floor.star.color}
            opacity={s.opacity}
          />
        ))}
      </Group>
      {fire !== 'Out' && glowImg && (
        <Image
          image={glowImg}
          x={0}
          y={height - glowH}
          width={width}
          height={glowH}
          fit="cover"
          opacity={breath}
        />
      )}
      <Group transform={[{ translateY: height - bandH }]}>
        {sparks.map((s) => (
          <SparkDot key={s.x0} spark={s} clock={clock} band={bandH} />
        ))}
      </Group>
    </Canvas>
  );
}

function SparkDot({ spark, clock, band }: { spark: Spark; clock: SharedValue<number>; band: number }) {
  const cx = useDerivedValue(() => sparkAt(spark, clock.value, band).x);
  const cy = useDerivedValue(() => sparkAt(spark, clock.value, band).y);
  const opacity = useDerivedValue(() => sparkAt(spark, clock.value, band).opacity);
  return <Circle cx={cx} cy={cy} r={spark.size} color={floor.ember.sparkColor} opacity={opacity} />;
}
