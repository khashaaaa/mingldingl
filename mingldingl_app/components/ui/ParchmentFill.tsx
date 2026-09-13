import { Image, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SURFACE } from '../../lib/theme';

/**
 * The parchment surface, drawn once instead of twice: a `SURFACE.raised → SURFACE.panel`
 * gradient with the parchment texture washed faintly over it. `AppCard`'s hero panel and
 * `DialogStrip` each carried their own copy of exactly this pairing — a card and a rising strip
 * agreeing, by coincidence rather than by sharing code, on what "this is parchment" looks like.
 * A re-tuned wash then meant finding both copies and hoping neither was missed.
 *
 * Purely decorative — a wash under content, never content itself — so it is marked
 * `importantForAccessibility="no"` and `accessible={false}` rather than left to a screen reader
 * to stumble into, and `pointerEvents="none"` on every layer so a tap always reaches whatever the
 * caller draws on top of it. Stops short of `accessibilityElementsHidden`/`aria-hidden`, which
 * hide a whole subtree even from a plain `getByTestId` — the two hero surfaces that mount this
 * already had tests reaching into their texture layer by testID before this component existed,
 * and hiding the subtree that hard would have broken them for no accessibility gain: nothing
 * inside carries a label a screen reader would otherwise announce.
 *
 * `style` is for the caller's own clipping, not its own look: `AppCard`'s hero panel rounds and
 * clips it to the card's corners so the texture cannot spill past them; `DialogStrip`'s own
 * container already clips, so it takes the default.
 */

interface Props {
  /** How much the texture shows through the gradient beneath it. */
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

export function ParchmentFill({ opacity = 0.06, style }: Props) {
  return (
    <View
      style={[StyleSheet.absoluteFillObject, style]}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no"
    >
      <LinearGradient colors={[SURFACE.raised, SURFACE.panel]} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
      <View testID="parchment-texture" style={[styles.texture, { opacity }]} pointerEvents="none">
        <Image
          source={require('../../assets/textures/parchment.png')}
          style={styles.image}
          resizeMode="cover"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  texture: StyleSheet.absoluteFillObject,
  image: { width: '100%', height: '100%' },
});
