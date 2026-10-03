import { useEffect, useRef } from 'react';
import { View, Animated, Image, PixelRatio, StyleSheet } from 'react-native';
import { colorForTier, shadeForTier, presenceForTier, TIER_ORDER } from '../../lib/tiers';
import type { GemTier } from '../../models/user';
import { BADGE_SIZES, INK, tint } from '../../lib/theme';
import { GEM_IMAGES, GEM_PIXELS, type GemLayer } from './gemImages';
import { Glyph } from '../ui/Glyph';
import { TorchGlow } from '../vfx/TorchGlow';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

interface Props {
  tier: string;
  size?: number;

  /**
   * Whether this badge is allowed to burn at all — the hero placements (profile, progression) pass
   * it, a badge in a list does not. *How brightly* it burns is not this flag's business: that is
   * the tier's rank, via `presenceForTier`.
   */
  glow?: boolean;

  color?: string;
  shade?: string;
}

/**
 * Rank is drawn here, and only here. The jewels are luminance-matched on purpose — see the
 * `GEM_COLORS` note in `theme.ts` — so hue and cut say *which stone* (each tier is cut its own way,
 * `scripts/gen-gems.js`: round brilliant, cabochon, crystal point, cushion, trillion, emerald cut)
 * and this badge's setting, glow and glint say *how high*. Before this the badge gated all three on `tierIndex >= 3`, which
 * made tiers 1-3 identical to each other and tiers 4-6 identical to each other: the ladder was
 * six rungs of data rendered as two.
 */
/** The setting's ink by ring weight: a hairline bezel for the first rungs, a bold one at the top. */
const SETTING_ALPHA = [0, 0.18, 0.32, 0.5] as const;

function layerFor(tier: GemTier, layer: GemLayer, size: number) {
  const pixels = size * PixelRatio.get();
  const baked = GEM_PIXELS.find((p) => p >= pixels) ?? GEM_PIXELS[GEM_PIXELS.length - 1];
  return GEM_IMAGES[tier][layer][baked];
}

export function GemTierBadge({ tier, size = BADGE_SIZES.hero, glow = false, color: colorOverride, shade: shadeOverride }: Props) {
  const color = colorOverride ?? colorForTier(tier);
  const shade = shadeOverride ?? shadeForTier(tier);
  const presence = presenceForTier(tier, size);
  const stone: GemTier = (TIER_ORDER as string[]).includes(tier) ? (tier as GemTier) : TIER_ORDER[0];

  const animate = motionAllowed(useVfxLevel());
  const hasShimmer = presence.shimmer > 0 && animate;
  const hasGlow = glow && presence.glowStrength > 0;

  // The glint: a spark that catches on the stone's upper facets now and then, sooner and brighter
  // the higher the tier. It replaced a bar swept across a square, which a cut stone has no edge for.
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

  const fill = { width: size, height: size };
  const layer = (name: GemLayer, tintColor: string, opacity = 1) => (
    <Image
      key={name}
      source={layerFor(stone, name, size)}
      style={[StyleSheet.absoluteFill, fill, { tintColor, opacity }]}
      fadeDuration={0}
    />
  );
  const sparkSize = size * 0.34;

  const badge = (
    <View style={fill}>
      {layer('setting', INK.primary, SETTING_ALPHA[presence.ringWidth] ?? SETTING_ALPHA[1])}
      {layer('body', color)}
      {layer('shade', shade)}
      {layer('light', tint(INK.primary, 0.95))}
      {hasShimmer && (
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

  if (hasGlow) {
    return (
      <TorchGlow size={size * 1.6} color={color} strength={presence.glowStrength}>
        {badge}
      </TorchGlow>
    );
  }
  return badge;
}
