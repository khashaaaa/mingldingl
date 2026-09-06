import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { ROOMS, type RoomTexture } from '../../lib/world';
import { useWorld } from './WorldProvider';

/**
 * The ground each room stands on. Not a texture: a tiled dungeon-brick wall read as red masonry
 * once the warm rooms washed gold over it, and it fought every card and every line of body copy
 * for attention. The room is now told apart by its *tone* and by how far the light opens it,
 * which is what the light ramp was always for — the brick was only ever carrying the ramp.
 *
 * Kept a shade off `COLORS.bg` rather than equal to it, so the ramp still has somewhere to go:
 * an unlit room sits nearly at the base ground, a fully lit one lifts a few points out of it.
 */
const GROUND: Record<RoomTexture, string> = {
  // Cold worked stone — the Gate, the Road, the Hearth, the Forge, the Hall.
  wall: '#232C42',
  // The Tavern. Warm brown here read as a brown *screen* rather than as a lit floor, so it now
  // takes the same stone as everywhere else; the row survives so one room can be re-floored
  // without the others following.
  parchment: '#232C42',
};

/**
 * Sits *behind* the navigator, so it only shows through screens that have given up their own
 * opaque background — which is why the floor migration could land screen by screen without
 * anything looking half-finished in between.
 */
export function WorldFloor() {
  const world = useWorld();
  const recipe = world?.recipe ?? null;
  const light = world?.light;
  const texture = world?.room ? ROOMS[world.room].texture : 'wall';

  // The ramp is inlined rather than calling `lerp`: this body is a worklet on the UI thread and a
  // plain import is not one.
  const style = useAnimatedStyle(() => {
    if (!recipe || !light) return { opacity: 0 };
    const t = Math.min(1, Math.max(0, light.value));
    const [a, b] = recipe.floor;
    return { opacity: a + (b - a) * t };
  }, [recipe]);

  if (!recipe) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, { backgroundColor: GROUND[texture] }, style]}
    />
  );
}
