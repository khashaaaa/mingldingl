import {
  Canvas,
  Circle,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Skia,
  vec,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { type SharedValue, useDerivedValue } from 'react-native-reanimated';
import { withAlpha } from '@/design/effects';
import { color } from '@/design/tokens';
import {
  AT,
  beam,
  easeOutCubic,
  flash,
  type Mote,
  moteAt,
  motes,
  type Shard,
  seg,
  shardAt,
  shards,
  shockwave,
} from './tierUpTimeline';

type Props = {
  clock: SharedValue<number>;
  /** Where the gems sit on screen. */
  cx: number;
  cy: number;
  width: number;
  height: number;
  /** The new tier's light, and the old gem's two colours for its pieces. */
  glow: string;
  oldCore: string;
  oldGlow: string;
};

const MOTES = 26;
const SHARDS = 22;
const CRACKS = 6;

/** Light behind the gems: the leak through the cracks, the beam, the forged gem's bloom and halo. */
export function TierUpBehind({ clock, cx, cy, width, height, glow }: Props) {
  const reach = Math.hypot(width, height) * 0.62;
  const field = useMemo(() => motes(MOTES), []);

  const halo = useDerivedValue(() => {
    const t = clock.value;
    if (t < AT.shatter) return 0.6 * seg(t, AT.crack, AT.shatter);
    if (t < AT.forge) return 0.6 * (1 - seg(t, AT.shatter, AT.shatter + 400));
    return seg(t, AT.forge, AT.forge + 500) * (0.75 + 0.15 * Math.sin((t - AT.forge) / 700));
  });
  const haloR = useDerivedValue(() => {
    const t = clock.value;
    return t < AT.forge ? 70 + 70 * seg(t, AT.crack, AT.shatter) : 170 + 10 * Math.sin((t - AT.forge) / 700);
  });
  // The forged gem's light: one soft bloom that swells in and breathes — never stripes of rays.
  const bloomO = useDerivedValue(() => {
    const t = clock.value;
    return seg(t, AT.forge, AT.forge + 900) * (0.85 + 0.15 * Math.sin((t - AT.forge) / 1100));
  });
  const bloomR = useDerivedValue(
    () => reach * (0.7 + 0.3 * easeOutCubic(seg(clock.value, AT.forge, AT.risen))),
  );
  const beamT = useDerivedValue(() => [{ translateX: cx }, { scaleX: beam(clock.value).width / 70 }]);
  const beamH = useDerivedValue(() => beam(clock.value).reach * height);
  const beamO = useDerivedValue(() => beam(clock.value).opacity);
  const ringR = useDerivedValue(() => shockwave(clock.value, width * 0.75).r);
  const ringO = useDerivedValue(() => shockwave(clock.value, width * 0.75).opacity);
  const ringW = useDerivedValue(() => shockwave(clock.value, width * 0.75).width);

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Circle cx={cx} cy={cy} r={bloomR} opacity={bloomO} dither>
        <RadialGradient
          c={vec(cx, cy)}
          r={bloomR}
          colors={[
            withAlpha(glow, 0.5),
            withAlpha(glow, 0.26),
            withAlpha(glow, 0.1),
            withAlpha(glow, 0.03),
            withAlpha(glow, 0),
          ]}
          positions={[0, 0.18, 0.42, 0.7, 1]}
        />
      </Circle>
      <Circle cx={cx} cy={cy} r={haloR} opacity={halo} dither>
        <RadialGradient
          c={vec(cx, cy)}
          r={haloR}
          colors={[withAlpha(color.textPrimary, 0.5), withAlpha(glow, 0.55), withAlpha(glow, 0)]}
          positions={[0, 0.35, 1]}
        />
      </Circle>
      <Group transform={beamT} opacity={beamO}>
        <Rect x={-35} y={0} width={70} height={beamH} dither>
          <LinearGradient
            start={vec(-35, 0)}
            end={vec(35, 0)}
            colors={[
              withAlpha(glow, 0),
              withAlpha(glow, 0.65),
              withAlpha(color.textPrimary, 0.95),
              withAlpha(glow, 0.65),
              withAlpha(glow, 0),
            ]}
            positions={[0, 0.3, 0.5, 0.7, 1]}
          />
        </Rect>
      </Group>
      <Circle cx={cx} cy={cy} r={ringR} opacity={ringO} style="stroke" strokeWidth={ringW} color={glow} />
      {field.map((m) => (
        <MoteDot key={`${m.x}-${m.phase}`} mote={m} clock={clock} cx={cx} cy={cy} color={glow} />
      ))}
    </Canvas>
  );
}

/** Over the gems: the cracks running through the old one, its pieces flying, and the flashes. */
export function TierUpOver({ clock, cx, cy, width, height, oldCore, oldGlow, glow }: Props) {
  const cracks = useMemo(() => {
    let s = 11;
    const rnd = () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
    return Array.from({ length: CRACKS }, (_, i) => {
      const p = Skia.Path.Make();
      let a = (i / CRACKS) * Math.PI * 2 + rnd() * 0.5;
      let x = cx + (rnd() - 0.5) * 8;
      let y = cy + (rnd() - 0.5) * 8;
      p.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        a += (rnd() - 0.5) * 0.9;
        const step = 12 + rnd() * 10;
        x += Math.cos(a) * step;
        y += Math.sin(a) * step;
        p.lineTo(x, y);
      }
      return p;
    });
  }, [cx, cy]);
  const pieces = useMemo(() => shards(SHARDS), []);
  const crackEnd = useDerivedValue(() => seg(clock.value, AT.crack + 120, AT.shatter - 60));
  const crackO = useDerivedValue(() => (clock.value >= AT.shatter ? 0 : 1));
  const flashO = useDerivedValue(() => flash(clock.value));

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group opacity={crackO}>
        {cracks.map((p, i) => (
          <Group
            // biome-ignore lint/suspicious/noArrayIndexKey: the cracks are a fixed drawing
            key={i}
          >
            <Path path={p} style="stroke" strokeWidth={5} color={withAlpha(glow, 0.5)} end={crackEnd} />
            <Path path={p} style="stroke" strokeWidth={1.6} color={color.textPrimary} end={crackEnd} />
          </Group>
        ))}
      </Group>
      {pieces.map((sh, i) => (
        <ShardPiece
          // biome-ignore lint/suspicious/noArrayIndexKey: the pieces are a fixed, seeded set
          key={i}
          shard={sh}
          clock={clock}
          cx={cx}
          cy={cy}
          color={sh.core ? oldCore : oldGlow}
        />
      ))}
      <Rect x={0} y={0} width={width} height={height} color={withAlpha(glow, 0.9)} opacity={flashO} />
    </Canvas>
  );
}

function ShardPiece({
  shard,
  clock,
  cx,
  cy,
  color: fill,
}: {
  shard: Shard;
  clock: SharedValue<number>;
  cx: number;
  cy: number;
  color: string;
}) {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    const [x0 = 0, y0 = 0, ...rest] = shard.points;
    p.moveTo(x0, y0);
    for (let k = 0; k < rest.length; k += 2) p.lineTo(rest[k] ?? 0, rest[k + 1] ?? 0);
    p.close();
    return p;
  }, [shard]);
  const transform = useDerivedValue(() => {
    const s = shardAt(shard, clock.value);
    return [{ translateX: cx + s.x }, { translateY: cy + s.y }, { rotate: s.rotate }];
  });
  const opacity = useDerivedValue(() => shardAt(shard, clock.value).opacity);
  return (
    <Group transform={transform} opacity={opacity}>
      <Path path={path} color={fill} />
      <Path path={path} style="stroke" strokeWidth={1} color={withAlpha(color.textPrimary, 0.6)} />
    </Group>
  );
}

function MoteDot({
  mote,
  clock,
  cx,
  cy,
  color: fill,
}: {
  mote: Mote;
  clock: SharedValue<number>;
  cx: number;
  cy: number;
  color: string;
}) {
  const x = useDerivedValue(() => cx + moteAt(mote, clock.value, 150, 420).x);
  const y = useDerivedValue(() => cy + moteAt(mote, clock.value, 150, 420).y);
  const opacity = useDerivedValue(() => moteAt(mote, clock.value, 150, 420).opacity);
  return <Circle cx={x} cy={y} r={mote.size} color={fill} opacity={opacity} />;
}
