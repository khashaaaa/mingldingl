import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colorForTier, shadeForTier, presenceForTier } from '../../lib/tiers';
import { COLORS, tint } from '../../lib/theme';
import { TorchGlow } from '../vfx/TorchGlow';

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
 * `GEM_COLORS` note in `theme.ts` — so hue says *which stone* and this badge's ring weight, glow
 * and shimmer say *how high*. Before this the badge gated all three on `tierIndex >= 3`, which
 * made tiers 1-3 identical to each other and tiers 4-6 identical to each other: the ladder was
 * six rungs of data rendered as two.
 */
export function GemTierBadge({ tier, size = 40, glow = false, color: colorOverride, shade: shadeOverride }: Props) {
  const color = colorOverride ?? colorForTier(tier);
  const shade = shadeOverride ?? shadeForTier(tier);
  const presence = presenceForTier(tier, size);

  const hasShimmer = presence.shimmer > 0;
  const hasGlow = glow && presence.glowStrength > 0;
  const gemSize = size * 0.68;
  const highlightSize = gemSize * 0.55;

  // A higher rank shines both brighter and more often, so the ramp still reads on a badge that is
  // only glanced at. Emerald keeps the 800ms cadence and 0.55 highlight that shipped before.
  const sweepDelay = 2400 - 1600 * presence.shimmer;
  const sweepAlpha = 0.2 + 0.35 * presence.shimmer;

  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!hasShimmer) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(sweepDelay),
        Animated.timing(sweep, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hasShimmer, sweepDelay, sweep]);

  const badge = (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: gemSize,
          height: gemSize,
          borderRadius: Math.max(2, size * 0.05),
          borderWidth: presence.ringWidth,
          // A heavier bezel that stayed at the same alpha read as a smudge rather than as weight.
          borderColor: tint(COLORS.text, 0.28 + 0.08 * (presence.ringWidth - 1)),
          overflow: 'hidden',
          transform: [{ rotate: '45deg' }],
        }}
      >
        <LinearGradient
          colors={[color, shade]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: 0,
            height: 0,
            borderLeftWidth: highlightSize,
            borderLeftColor: 'transparent',
            borderBottomWidth: highlightSize,
            borderBottomColor: tint(COLORS.text, 0.32),
          }}
        />
        {hasShimmer && (
          <Animated.View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: -gemSize * 0.5,
              left: -gemSize * 0.5,
              width: gemSize * 0.5,
              height: gemSize * 2,
              transform: [
                {
                  translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-gemSize * 0.5, gemSize * 1.5] }),
                },
              ],
            }}
          >
            <LinearGradient
              colors={['transparent', tint(COLORS.text, sweepAlpha), 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{ width: '100%', height: '100%' }}
            />
          </Animated.View>
        )}
      </View>
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
