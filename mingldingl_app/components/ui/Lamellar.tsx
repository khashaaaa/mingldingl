import { Image, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { MATERIAL } from '../../lib/theme';
import { LAMELLAR, METAL_IMAGES } from './metal';

interface Props {
  style?: StyleProp<ViewStyle>;
}

/**
 * A strip of lamellar — small riveted iron plates laced in a row, the armour of the steppe — in
 * place of a hairline. It stands above the Oath and nowhere else: the metal there is ancestral,
 * not steampunk, beside the Bronze Age carvings on the floor. The bake is a white silhouette
 * tinted iron, with the light and the lacing drawn over it; it is clipped, never stretched.
 */
export function Lamellar({ style }: Props) {
  return (
    <View
      style={[styles.strip, style]}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no"
      testID="lamellar"
    >
      <Image source={METAL_IMAGES.lamellar.body} style={[styles.img, { tintColor: MATERIAL.iron }]} />
      <Image source={METAL_IMAGES.lamellar.detail} style={styles.img} />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { height: LAMELLAR.height, overflow: 'hidden', alignSelf: 'stretch' },
  img: { position: 'absolute', left: 0, top: 0, width: LAMELLAR.width, height: LAMELLAR.height },
});
