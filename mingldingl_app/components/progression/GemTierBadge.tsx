import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colorForTier, shadeForTier, TIER_ORDER } from '../../lib/tiers';
import { TorchGlow } from '../vfx/TorchGlow';

interface Props {
  tier: string;
  size?: number;
  // Wraps the badge in TorchGlow, growing more intense at higher tiers — opt-in
  // and meant for the one or two large "this is your character" badges
  // (profile, progression), not the small inline uses (HUD, candidate cards,
  // perk lists) where a glow per instance would be noisy and wasteful.
  glow?: boolean;
  // Paint the gem with an explicit color/shade instead of the ones looked up
  // for `tier`. `tier` still drives the shimmer-eligibility gate below — this
  // is for callers (e.g. membership tier badges) that need `tier` to pick a
  // rarity rank for animation purposes but a different, more literal color
  // than that gemstone's real hue.
  color?: string;
  shade?: string;
}

// Top half of the tier ladder (Sapphire/Ruby/Emerald) gets an animated shine
// sweep so rank reads as visually aspirational at a glance, not just a
// different fill color — matching how rarer cards look distinct in most
// loot-card games. Skipped below SHIMMER_MIN_SIZE: the small inline uses
// (XPBar/ScoreHUD/TierPerkCard) would otherwise run a permanent Animated
// loop on every mount of what's meant to be a quiet glyph-sized accent.
const SHIMMER_MIN_INDEX = 3;
const SHIMMER_MIN_SIZE = 32;

// A gem silhouette, not an emoji-in-a-frame: a 45°-rotated square reads as a
// cut stone (same shorthand as a playing-card diamond), given a tier-color
// gradient (bright crown catching light -> deep pavilion in shadow) and a
// corner-triangle highlight built with the same border trick QuestTile's
// rune box uses elsewhere in this app.
export function GemTierBadge({ tier, size = 40, glow = false, color: colorOverride, shade: shadeOverride }: Props) {
  const color = colorOverride ?? colorForTier(tier);
  const shade = shadeOverride ?? shadeForTier(tier);
  const tierIndex = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number]);
  const hasShimmer = tierIndex >= SHIMMER_MIN_INDEX && size >= SHIMMER_MIN_SIZE;
  // Same tier/size gate as the shimmer sweep, so the two "you've ranked up"
  // cues always appear together rather than one lagging the other in.
  const hasGlow = glow && hasShimmer;
  const gemSize = size * 0.68;
  const highlightSize = gemSize * 0.55;

  const sweep = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!hasShimmer) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(800),
        Animated.timing(sweep, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [hasShimmer, sweep]);

  const badge = (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          width: gemSize,
          height: gemSize,
          borderRadius: Math.max(2, size * 0.05),
          borderWidth: 1,
          borderColor: 'rgba(237,228,211,0.28)',
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
            borderBottomColor: 'rgba(255,255,255,0.32)',
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
              colors={['transparent', 'rgba(255,255,255,0.55)', 'transparent']}
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
      <TorchGlow size={size * 1.6} color={color}>
        {badge}
      </TorchGlow>
    );
  }
  return badge;
}
