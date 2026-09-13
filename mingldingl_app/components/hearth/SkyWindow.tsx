import { View, StyleSheet } from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, LinearGradient, Rect, Stop } from 'react-native-svg';
import { FROST_RIM_REACH, FrostEdge } from '../vfx/FrostEdge';
import { i18n } from '../../lib/i18n';
import { ACCENT, INK, NIGHT, RADIUS, tint } from '../../lib/theme';
import type { DayPhase } from '../../lib/world/light';

/**
 * The window over the hearth, and the only thing in the app that shows the real world: the sky at
 * whatever hour it actually is on the device, read straight off `dayPhase`. "The sky belongs to
 * time" (the dials, 2026-09-11) — no new mechanic, no server, nothing to earn. Night while you
 * sleep, dawn when the fires are judged, day, dusk.
 *
 * Deliberately still. Every other drawing in the hold that moves does so because something
 * happened; a sky that drifted would be the one animation on screen reporting nothing, and it
 * would run for as long as someone left the hearth open.
 */

/** Fixed per the brief: an `Svg` `width × 160`. */
const SKY_HEIGHT = 160;

/**
 * Two stops per hour, held against the palette's own tokens rather than written out as hex, so a
 * re-tuned `NIGHT` or a re-tuned gold carries the sky with it. Exported because the four gradients
 * *are* the spec of this component — a test can pin them without rendering four trees and digging
 * colours back out of `react-native-svg`'s packed props.
 */
export const SKY_GRADIENTS: Record<DayPhase, readonly [string, string]> = {
  night: [NIGHT.black, NIGHT.blue],
  dawn: [NIGHT.blue, tint(ACCENT.bright, 0.5)],
  day: [NIGHT.blue, tint(INK.primary, 0.25)],
  dusk: [NIGHT.brown, NIGHT.black],
};

/** Which hours have stars in them, and which have a glow on the horizon. */
const STARLIT: readonly DayPhase[] = ['night', 'dawn'];
const HORIZON_LIT: readonly DayPhase[] = ['dawn', 'dusk'];

/**
 * Twelve stars, fixed rather than random: a sky that reshuffled itself on every render would be a
 * different sky each time the screen was opened, and the hearth is the one place that is meant to
 * be the same place. `x` and `y` are fractions of the window so the constellation holds its shape
 * at any card width; `r` is in px, since a star does not grow with the phone.
 */
const STARS: readonly (readonly [number, number, number])[] = [
  [0.08, 0.14, 1.5], [0.19, 0.34, 1], [0.27, 0.09, 2], [0.36, 0.26, 1],
  [0.44, 0.44, 1.5], [0.52, 0.12, 1], [0.60, 0.31, 2], [0.68, 0.18, 1],
  [0.76, 0.40, 1.5], [0.83, 0.11, 1], [0.90, 0.29, 1.5], [0.96, 0.20, 1],
];

/** The horizon's own geometry: a wide, shallow ellipse sitting on the bottom edge, so only its
 *  upper half shows and the light reads as coming from beyond the sill. */
const GLOW_RX_RATIO = 0.72;
const GLOW_RY = 44;
const GLOW_OPACITY = 0.25;

interface Props {
  phase: DayPhase;
  /** Measured by the caller (`onLayout`), the way `AscentSky`'s width is. */
  width: number;
  /** The three days of Tsagaan Sar: frost on the glass. */
  whiteMoon: boolean;
}

export function SkyWindow({ phase, width, whiteMoon }: Props) {
  const [from, to] = SKY_GRADIENTS[phase];

  return (
    // One node, one sentence. A screen reader walking a dozen unnamed circles learns nothing; the
    // label says what the sky is doing, which is the whole content of the drawing.
    <View
      testID="sky-window"
      accessible
      accessibilityLabel={i18n.t(`sky_${phase}`)}
    >
      <Svg width={width} height={SKY_HEIGHT} accessible={false} importantForAccessibility="no">
        <Defs>
          <LinearGradient id="skyFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
          {/* The card's own corners, so the horizon glow cannot bleed past the sill. Only the top
              two: the window sits at the head of the card, and a rect that rounded off at the sill
              too would notch the sky open onto the parchment right where the copy begins — so the
              rect runs `RADIUS.md` past the bottom of the canvas, where its own rounding is cut
              off by the viewport instead. */}
          <ClipPath id="skyClip">
            <Rect x={0} y={0} width={width} height={SKY_HEIGHT + RADIUS.md} rx={RADIUS.md} ry={RADIUS.md} />
          </ClipPath>
        </Defs>
        <G clipPath="url(#skyClip)">
          <Rect x={0} y={0} width={width} height={SKY_HEIGHT} fill="url(#skyFill)" />
          {HORIZON_LIT.includes(phase) && (
            <Ellipse
              testID="sky-glow"
              cx={width / 2}
              cy={SKY_HEIGHT}
              rx={width * GLOW_RX_RATIO}
              ry={GLOW_RY}
              fill={ACCENT.bright}
              opacity={GLOW_OPACITY}
            />
          )}
          {STARLIT.includes(phase) && STARS.map(([x, y, r]) => (
            <Circle
              key={`${x},${y}`}
              testID="sky-star"
              cx={width * x}
              cy={SKY_HEIGHT * y}
              r={r}
              fill={INK.muted}
            />
          ))}
        </G>
      </Svg>
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
  rimTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  rimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});
