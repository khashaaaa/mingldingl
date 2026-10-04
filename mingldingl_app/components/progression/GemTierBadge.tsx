import { useEffect, useRef } from 'react';
import { View, Animated, Easing, Image, PixelRatio, StyleSheet } from 'react-native';
import { colorForTier, presenceForTier, TIER_ORDER } from '../../lib/tiers';
import type { GemTier } from '../../models/user';
import { BADGE_SIZES, INK, SURFACE } from '../../lib/theme';
import { GEM_IMAGES, GEM_STILL_PIXELS, GEM_SWAY_PIXELS, GEM_SWAY_FRAMES, GEM_SWAY_COLS } from './gemImages';
import { Glyph } from '../ui/Glyph';
import { TorchGlow } from '../vfx/TorchGlow';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

interface Props {
  tier: string;
  size?: number;

  /**
   * Whether this badge is allowed to burn at all — the hero placements (profile, progression) pass
   * it, a badge in a list does not. A burning badge also sways: the stone rocks on its axis and
   * its light breathes. *How brightly* it burns is not this flag's business: that is the tier's
   * rank, via `presenceForTier`.
   */
  glow?: boolean;

  /** A stone not yet reached (The Ascent): the same stone, sunk into the dark. */
  dim?: boolean;
}

/** How far a dimmed stone sinks: the ground laid over it at this opacity, in its own silhouette. */
const DIM = 0.55;
/** One full rock of the sway, both ways and back. */
const SWAY_MS = 3600;

/**
 * The six stones are painted, not tinted: full-colour images baked by `scripts/gen-gems.js`, each
 * cut its own way and better the higher the tier — a rough garnet, a tumbled opal, an amethyst
 * cluster, a sapphire shard, a ruby brilliant, an emerald step cut. The cut and the colour say
 * which stone; the cut, glow and glint say how high.
 */
function pick<P extends number>(sizes: readonly P[], size: number): P {
  const pixels = size * PixelRatio.get();
  return sizes.find((p) => p >= pixels) ?? sizes[sizes.length - 1];
}

/**
 * The sheet steps from pose to pose rather than sliding between them. Each pose owns a slice of
 * the driver's 0..FRAMES range; the interpolation holds flat across it and jumps at its edge.
 */
const STEP_IN: number[] = [];
const STEP_COL: number[] = [];
const STEP_ROW: number[] = [];
for (let f = 0; f < GEM_SWAY_FRAMES; f++) {
  STEP_IN.push(f, f + 0.999);
  STEP_COL.push(f % GEM_SWAY_COLS, f % GEM_SWAY_COLS);
  STEP_ROW.push(Math.floor(f / GEM_SWAY_COLS), Math.floor(f / GEM_SWAY_COLS));
}

export function GemTierBadge({ tier, size = BADGE_SIZES.hero, glow = false, dim = false }: Props) {
  const color = colorForTier(tier);
  const presence = presenceForTier(tier, size);
  const stone: GemTier = (TIER_ORDER as string[]).includes(tier) ? (tier as GemTier) : TIER_ORDER[0];

  const animate = motionAllowed(useVfxLevel());
  const hasGlow = glow && presence.glowStrength > 0;
  const sways = glow && animate && !dim;
  // The sway sheet carries its own sparks; the runtime glint is for the stills.
  const hasShimmer = presence.shimmer > 0 && animate && !sways;

  // The glint: a spark that catches on the stone's upper facets now and then, sooner and brighter
  // the higher the tier.
  const glintDelay = 2400 - 1600 * presence.shimmer;
  const glintPeak = 0.45 + 0.5 * presence.shimmer;
  const glint = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!hasShimmer) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(glintDelay),
        Animated.timing(glint, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(glint, { toValue: 0, duration: 450, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hasShimmer, glintDelay, glint]);

  const pose = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!sways) return;
    pose.setValue(0);
    const loop = Animated.loop(
      Animated.timing(pose, { toValue: GEM_SWAY_FRAMES, duration: SWAY_MS, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [sways, pose]);

  const fill = { width: size, height: size };
  const still = GEM_IMAGES[stone].still[pick(GEM_STILL_PIXELS, size)];
  const sparkSize = size * 0.34;

  const badge = sways ? (
    <View style={[fill, styles.clip]}>
      <Animated.Image
        source={GEM_IMAGES[stone].sway[pick(GEM_SWAY_PIXELS, size)]}
        fadeDuration={0}
        style={{
          width: size * GEM_SWAY_COLS,
          height: size * Math.ceil(GEM_SWAY_FRAMES / GEM_SWAY_COLS),
          transform: [
            { translateX: pose.interpolate({ inputRange: STEP_IN, outputRange: STEP_COL.map((c) => -c * size) }) },
            { translateY: pose.interpolate({ inputRange: STEP_IN, outputRange: STEP_ROW.map((r) => -r * size) }) },
          ],
        }}
      />
    </View>
  ) : (
    <View style={fill}>
      <Image source={still} style={[StyleSheet.absoluteFill, fill]} fadeDuration={0} />
      {dim && <Image source={still} style={[StyleSheet.absoluteFill, fill, { tintColor: SURFACE.ground, opacity: DIM }]} fadeDuration={0} />}
      {hasShimmer && !dim && (
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: size * 0.2,
            top: size * 0.14,
            opacity: glint.interpolate({ inputRange: [0, 1], outputRange: [0, glintPeak] }),
            transform: [{ scale: glint.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
          }}
        >
          <Glyph name="spark" size={sparkSize} color={INK.primary} />
        </Animated.View>
      )}
    </View>
  );

  if (hasGlow && !dim) {
    return (
      <TorchGlow size={size * 1.6} color={color} strength={presence.glowStrength}>
        {badge}
      </TorchGlow>
    );
  }
  return badge;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
