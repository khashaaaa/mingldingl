import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { curve, MOTION, useReduceMotion } from '../motion';
import { color } from '../tokens';
import { Art } from './Art';
import { GEM, type Tier } from './GemBadge';
import { Glow } from './Glow';

/**
 * Your own gem, alive (Figma motion "Gem idle"): it floats a breath up and down in its own light.
 * Only the gem you hold does this; every other gem lies still.
 */
export function LiveGem({ tier, size }: { tier: Tier; size: number }) {
  const reduce = useReduceMotion();
  const m = MOTION.gemIdle;
  const k = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    k.value = withRepeat(withTiming(1, { duration: m.duration, easing: curve(m.easing) }), -1, true);
    return () => cancelAnimation(k);
  }, [k, reduce]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: -size * 0.06 * k.value }] }));
  const reach = size * 0.55;
  return (
    <View style={{ width: size, height: size }}>
      <View pointerEvents="none" style={[styles.light, { margin: -reach }]}>
        <Glow tint={color[`gem${tier}Glow`]} strength={0.45} />
      </View>
      <Animated.View style={float}>
        <Art name={GEM[tier]} style={{ width: size, height: size }} fit="contain" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  light: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
});
