import { Image, View, StyleSheet, type ImageSourcePropType } from 'react-native';
import { FROST_RIM_REACH, FrostEdge } from '../vfx/FrostEdge';
import { i18n } from '../../lib/i18n';
import { RADIUS } from '../../lib/theme';
import type { DayPhase } from '../../lib/world/light';

/**
 * The window over the hearth, and the only thing in the app that shows the real world: the sky at
 * whatever hour it actually is on the device, read straight off `dayPhase`. "The sky belongs to
 * time" (the dials, 2026-09-11) — no new mechanic, no server, nothing to earn. Night while you
 * sleep, dawn when the fires are judged, day, dusk.
 *
 * Each hour is one ink-wash painting of the same place (`scripts/gen-sky.js`): the steppe running
 * back to the far peaks, a ger on the near rise with its smoke going up, grass in the foreground.
 * The Milky Way at night, the sun still under the ridge at dawn, washed snow ranges by day, the
 * sun going into the peaks at dusk, and the ger's door lit whenever it is dark. Until 2026-10-03
 * the window was a two-stop gradient with twelve dots and a glow, and it read as an empty box.
 *
 * Deliberately still. Every other drawing in the hold that moves does so because something
 * happened; a sky that drifted would be the one animation on screen reporting nothing, and it
 * would run for as long as someone left the hearth open.
 */

/** Fixed per the brief: `width × 160`. */
const SKY_HEIGHT = 160;

/** The painting for each hour. Exported so a test can pin that every hour has its own. */
export const SKY_PAINTINGS: Record<DayPhase, ImageSourcePropType> = {
  night: require('../../assets/sky/night.png'),
  dawn: require('../../assets/sky/dawn.png'),
  day: require('../../assets/sky/day.png'),
  dusk: require('../../assets/sky/dusk.png'),
};

interface Props {
  phase: DayPhase;
  /** Measured by the caller (`onLayout`), the way `AscentSky`'s width is. */
  width: number;
  /** The three days of Tsagaan Sar: frost on the glass. */
  whiteMoon: boolean;
}

export function SkyWindow({ phase, width, whiteMoon }: Props) {
  return (
    // One node, one sentence: the label says what the sky is doing, which is the whole content of
    // the painting. A baked image, not an `Svg` — on Android an SVG is rasterized on the CPU into a
    // bitmap the size of the window, a large share of the Hearth's opening frame on the A51.
    <View
      testID="sky-window"
      accessible
      accessibilityLabel={i18n.t(`sky_${phase}`)}
    >
      {/* The card's own corners, top only: the window sits at the head of the card, and rounding
          the sill too would notch the sky open onto the parchment right where the copy begins.
          `cover`, anchored by the painting's own composition: a narrower card loses a little
          steppe at either side, never the ger. */}
      <View style={[styles.glass, { width }]}>
        <Image
          testID={`sky-${phase}`}
          source={SKY_PAINTINGS[phase]}
          style={{ width, height: SKY_HEIGHT }}
          resizeMode="cover"
          fadeDuration={0}
        />
      </View>
      {whiteMoon && (
        // `FrostEdge` only answers "what does frost look like" — where it sits is the caller's, so
        // the two rims are anchored here. `FROST_RIM_REACH` rather than the default 96: there is
        // content close under this window, and a full-depth crystal would draw straight through it.
        <>
          <View style={styles.rimTop} pointerEvents="none">
            <FrostEdge edge="top" length={FROST_RIM_REACH} />
          </View>
          <View style={styles.rimBottom} pointerEvents="none">
            <FrostEdge edge="bottom" length={FROST_RIM_REACH} />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    height: SKY_HEIGHT,
    overflow: 'hidden',
    borderTopLeftRadius: RADIUS.md,
    borderTopRightRadius: RADIUS.md,
  },
  rimTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  rimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
