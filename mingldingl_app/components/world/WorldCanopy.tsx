import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { EmberField } from '../vfx/EmberField';
import { FogDrift } from '../vfx/FogDrift';
import { ROOMS, VIGNETTE_EDGE } from '../../lib/world';
import { useWorld } from './WorldProvider';

/**
 * Everything painted *over* the navigator: the vignette that closes a dark room in, the room's
 * colour wash, and whatever drifts through it. Unlike the floor it needs no cooperation from the
 * screen underneath, so the hold is lit from the first commit even where screens still carry
 * their own background.
 *
 * The drift band is anchored to the bottom 45% on purpose — embers and fog belong at floor level,
 * and keeping them out of the middle keeps them off body copy, which is where the Ulzii doctrine
 * ("never behind text") and plain legibility agree.
 */
export function WorldCanopy() {
  const world = useWorld();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const recipe = world?.recipe ?? null;
  const light = world?.light;
  const vfx = world?.room ? ROOMS[world.room].vfx : null;

  const vignetteStyle = useAnimatedStyle(() => {
    if (!recipe || !light) return { opacity: 0 };
    const t = Math.min(1, Math.max(0, light.value));
    const [a, b] = recipe.vignette;
    return { opacity: a + (b - a) * t };
  }, [recipe]);

  const washStyle = useAnimatedStyle(() => {
    if (!recipe || !light) return { opacity: 0 };
    const t = Math.min(1, Math.max(0, light.value));
    const [a, b] = recipe.washAlpha;
    return { opacity: a + (b - a) * t };
  }, [recipe]);

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }

  if (!recipe) return null;
  const bandHeight = size.h * 0.45;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout} testID="world-canopy">
      <Animated.View style={[StyleSheet.absoluteFill, vignetteStyle]}>
        <LinearGradient
          colors={[VIGNETTE_EDGE, 'transparent', 'transparent', VIGNETTE_EDGE]}
          locations={[0, 0.3, 0.68, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: recipe.wash }, washStyle]} />
      {vfx && size.w > 0 && (
        <View style={[styles.band, { height: bandHeight }]}>
          {vfx === 'ember'
            ? <EmberField width={size.w} height={bandHeight} density={6} />
            : <FogDrift width={size.w} height={bandHeight} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
