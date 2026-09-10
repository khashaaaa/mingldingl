import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { ROOMS, type RoomTexture } from '../../lib/world';
import { useReforgedTint } from '../../lib/world/session';
import { tint } from '../../lib/theme';
import { useWorld } from './WorldProvider';

/**
 * The ground each room stands on, and the light rising off it.
 *
 * Not a texture: a tiled dungeon-brick wall read as red masonry once the warm rooms washed gold
 * over it, and it fought every card and every line of body copy for attention. What replaced it
 * was a flat colour so close to `COLORS.bg` that all six rooms became one — the ground stopped
 * fighting the UI by ceasing to exist.
 *
 * Both problems were about being *in front of* the content. This layer sits behind the navigator,
 * so it is the one place in the app where colour is free: a warm floor here can be as warm as the
 * Tavern needs without ever tinting a word of text. That is why the room's `tone` lives on this
 * layer rather than in the canopy's wash, where it twice had to be turned down to nothing.
 */
const GROUND: Record<RoomTexture, string> = {
  // Cold worked stone — the Gate, the Road, the Hearth, the Forge, the Hall.
  wall: '#232C42',
  // The Tavern. Warm dark earth: at the 0.14–0.20 opacity this layer runs at, it lands a few
  // points off the stone rather than as the brown *screen* the old parchment floor became.
  parchment: '#3A2C1E',
};

/**
 * Where the room's light falls off, top to bottom: gone by the top sixth, half way up, and at
 * full strength only along the very bottom edge. Full strength across a *band* would read as a
 * coloured floor rather than as light coming off one.
 */
const TONE_STOPS = [0.15, 0.55, 1] as const;

/**
 * How strongly the reforged gem colours the floor, at the bottom edge. Deliberately under the
 * room tone's own floor: the afterglow of a tier-up should be felt in every room for the rest of
 * the session, never *seen* as a coloured band, and never argue with the Tavern's warmth.
 */
const REFORGED_ALPHA = 0.1;

export function WorldFloor() {
  const world = useWorld();
  const reforged = useReforgedTint();
  const recipe = world?.recipe ?? null;
  const light = world?.light;
  const texture = world?.room ? ROOMS[world.room].texture : 'wall';

  // The ramps are inlined rather than calling `lerp`: these bodies are worklets on the UI thread
  // and a plain import is not one.
  const groundStyle = useAnimatedStyle(() => {
    if (!recipe || !light) return { opacity: 0 };
    const t = Math.min(1, Math.max(0, light.value));
    const [a, b] = recipe.floor;
    return { opacity: a + (b - a) * t };
  }, [recipe]);

  const toneStyle = useAnimatedStyle(() => {
    if (!recipe || !light) return { opacity: 0 };
    const t = Math.min(1, Math.max(0, light.value));
    const [a, b] = recipe.toneAlpha;
    return { opacity: a + (b - a) * t };
  }, [recipe]);

  if (!recipe) return null;
  return (
    <>
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: GROUND[texture] }, groundStyle]}
      />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, toneStyle]}>
        <LinearGradient
          // Bottom-anchored: the room's fire is on its floor, not in its air.
          colors={[tint(recipe.tone, 0), tint(recipe.tone, 0.45), recipe.tone]}
          locations={TONE_STOPS}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      {reforged && (
        // Above the tone, still on the floor: behind the navigator, so no word of text takes the hue.
        <View pointerEvents="none" style={StyleSheet.absoluteFill} testID="world-floor-reforged">
          <LinearGradient
            colors={[tint(reforged, 0), tint(reforged, REFORGED_ALPHA * 0.45), tint(reforged, REFORGED_ALPHA)]}
            locations={TONE_STOPS}
            style={StyleSheet.absoluteFill}
          />
        </View>
      )}
    </>
  );
}
