import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import { FROST_LAYERS } from '../vfx/FrostEdge';

/**
 * The ice that closes over a thread left to freeze: crystal shards standing up out of a ledge on
 * the slab that replaced the composer, tall against the sides and low through the middle, frost
 * ferns between them and crystals in the air (`scripts/gen-ice.js`). The body is translucent, so
 * the Deep's painted monsters behind it read as frozen into the wall.
 *
 * It stands at the foot of the ledger, on the ended notice below it, and the ledger leaves its
 * height free below the last letter (`frozenOverHeight`), so the ice covers nothing
 * until the reader scrolls back through it.
 */

const SOURCES = {
  fill: require('../../assets/ice/frozen-fill.png'),
  ink: require('../../assets/ice/frozen-ink.png'),
  shine: require('../../assets/ice/frozen-shine.png'),
} as const;

const ASPECT = 3;
/** Past this width the field stops growing, as the carvings do. */
const MAX_WIDTH = 540;

export function frozenOverHeight(screenWidth: number): number {
  return Math.min(screenWidth, MAX_WIDTH) / ASPECT;
}

export function FrozenOver() {
  const { width } = useWindowDimensions();
  const height = frozenOverHeight(width);
  return (
    <View
      testID="frozen-over"
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      aria-hidden
      style={[styles.field, { height }]}
    >
      {FROST_LAYERS.map(({ layer, color, alpha }) => (
        <Image
          key={layer}
          source={SOURCES[layer]}
          resizeMode="contain"
          style={[styles.layer, { height, tintColor: color, opacity: alpha }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Stands on the foot of the ledger — the slab that replaced the composer is right below it.
  field: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center' },
  layer: { position: 'absolute', bottom: 0, width: '100%', maxWidth: MAX_WIDTH },
});
