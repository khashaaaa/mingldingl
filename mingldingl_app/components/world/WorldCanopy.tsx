import { useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { EmberField } from '../vfx/EmberField';
import { FogDrift } from '../vfx/FogDrift';
import { ROOM_VIGNETTE_STOPS, ROOMS } from '../../lib/world';
import { useWorld } from './WorldProvider';
import { Vignette } from './Vignette';

/**
 * Everything painted *over* the navigator: the vignette that closes a dark room in, and whatever
 * drifts through it.
 *
 * It used to paint a third thing — a flat full-screen colour wash — and that layer is gone. Every
 * time it carried enough colour to tell one room from another it read as a film over the UI, and
 * every time it was turned down far enough not to, the rooms stopped being distinguishable. A
 * layer in front of the content is the wrong place to put a room's colour, so the room's `tone`
 * now rises off `WorldFloor`, behind the navigator, where it can be as strong as it needs to be.
 * What is left here is the vignette, which only ever touches the margins — and which now carries
 * the room's `edge`, because night has a temperature too.
 *
 * The drift band is anchored to the bottom 45% on purpose — embers and fog belong at floor level,
 * and keeping them out of the middle keeps them off body copy, which is where the Ulzii doctrine
 * ("never behind text") and plain legibility agree.
 */
export function WorldCanopy() {
  const world = useWorld();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const recipe = world?.recipe ?? null;
  const vfx = world?.room ? ROOMS[world.room].vfx : null;

  function onLayout(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setSize({ w: width, h: height });
  }

  if (!recipe) return null;
  const bandHeight = size.h * 0.45;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} onLayout={onLayout} testID="world-canopy">
      <Vignette range={recipe.vignette} locations={ROOM_VIGNETTE_STOPS} />
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
