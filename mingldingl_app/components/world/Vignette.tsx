import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { PHASE_EDGE } from '../../lib/world';
import { useWorld } from './WorldProvider';

interface Props {
  /**
   * Opacity at no light and at full light, in that order. Both existing callers darken as the
   * room darkens, so the first number is usually the larger one.
   */
  range: readonly [number, number];

  /** The four gradient stops: opaque, clear, clear, opaque, as fractions of the box. */
  locations: readonly [number, number, number, number];

  /** Left-to-right instead of top-to-bottom. */
  horizontal?: boolean;
  testID?: string;
}

/**
 * The dark closing in, as one implementation.
 *
 * `WorldCanopy` and `RoomLight` were drawing the same four-stop falloff off the same `light`
 * shared value, and the copy had already let them diverge on the thing that matters: the canopy
 * paints the room's own `edge`, temperature-shifted by the hour, while the card's copy hardcoded
 * a neutral grey. So a candidate in the middle of the Road was lit by colourless light while the
 * margins six pixels away were lit by a blue or a brown one, and re-tuning a room moved the frame
 * but not the card.
 *
 * One child, deliberately: an `Animated.View` with an animated alpha and more than one child
 * forces Android to composite the subtree offscreen for the whole transition.
 */
export function Vignette({ range, locations, horizontal, testID }: Props) {
  const world = useWorld();
  const light = world?.light;
  // By day the room keeps its own temperature; at other hours the sky lends its own — the same
  // rule the canopy has always used, now applied to both layers because they share this code.
  const edge = (world?.phase ? PHASE_EDGE[world.phase] : null) ?? world?.recipe?.edge ?? null;

  const style = useAnimatedStyle(() => {
    if (!light) return { opacity: 0 };
    const t = Math.min(1, Math.max(0, light.value));
    return { opacity: range[0] + (range[1] - range[0]) * t };
  }, [light, range]);

  if (!light || !edge) return null;

  return (
    <Animated.View
      testID={testID}
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
    >
      <LinearGradient
        colors={[edge, 'transparent', 'transparent', edge]}
        locations={locations as unknown as [number, number, number, number]}
        style={StyleSheet.absoluteFill}
        {...(horizontal ? { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } } : null)}
      />
    </Animated.View>
  );
}
