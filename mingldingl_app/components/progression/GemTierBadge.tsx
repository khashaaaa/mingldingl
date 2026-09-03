import { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colorForTier, shadeForTier, TIER_ORDER } from '../../lib/tiers';
import { COLORS, tint } from '../../lib/theme';
import { TorchGlow } from '../vfx/TorchGlow';

interface Props {
  tier: string;
  size?: number;

  glow?: boolean;

  color?: string;
  shade?: string;
}

const SHIMMER_MIN_INDEX = 3;
const SHIMMER_MIN_SIZE = 32;

export function GemTierBadge({ tier, size = 40, glow = false, color: colorOverride, shade: shadeOverride }: Props) {
  const color = colorOverride ?? colorForTier(tier);
  const shade = shadeOverride ?? shadeForTier(tier);
  const tierIndex = TIER_ORDER.indexOf(tier as (typeof TIER_ORDER)[number]);
  const hasShimmer = tierIndex >= SHIMMER_MIN_INDEX && size >= SHIMMER_MIN_SIZE;

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
          borderColor: tint(COLORS.text, 0.28),
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
              colors={['transparent', tint(COLORS.text, 0.55), 'transparent']}
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
