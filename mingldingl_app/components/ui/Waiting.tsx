import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { STROKE } from './Glyph';
import { ACCENT, ICON_SIZES } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

interface Props {
  size?: number;
  /** Tints the candle, so a button can pass its own label metal. */
  color?: string;
}

/** The cuts: `Glyph`'s candle, split so the flame can move without the wax — in `Glyph`'s weight. */
const WAX = ['M9 8h6v11H9z', 'M7 19h10v2H7z'];
const FLAME = 'M12 2l2 3-2 3-2-3z';

const FLICKER_MS = 900;
/** How far the flame drops at the bottom of a breath — a guttering candle, not a blinking light. */
const FLAME_LOW = 0.62;
const FLAME_SQUAT = 0.88;
/** The flame's own base, so it shrinks into the wick rather than around its middle. */
const WICK = '50% 33%';

/**
 * The short wait: a candle, burning.
 *
 * Replaces `ActivityIndicator` wherever a wait is a moment rather than an event — a button
 * submitting, a photo uploading. It was an ulzii knot spinning, which is the same promise every
 * other app makes with the same rotating shape; a candle says the thing this app says
 * everywhere else, that someone is holding a light while you wait.
 *
 * Drawn rather than tinted from an image: the flame has to move on its own, and an `Image` can
 * only turn as one piece. The wax is stroked and the flame is filled, because at 16px inside a
 * button an outlined flame is four hairlines and a hole — the fill is what survives the size.
 *
 * It carries no text label deliberately: the only string available would be English (the house
 * rule forbids guessed Mongolian), and an English word read aloud to a Mongolian speaker is
 * worse than the platform's own localised "progress bar" from `accessibilityRole`.
 */
export function Waiting({ size = ICON_SIZES.lg, color = ACCENT.base }: Props) {
  const level = useVfxLevel();
  const animate = motionAllowed(level);
  const flicker = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      flicker.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, { toValue: 1, duration: FLICKER_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(flicker, { toValue: 0, duration: FLICKER_MS, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, flicker]);

  const opacity = flicker.interpolate({ inputRange: [0, 1], outputRange: [1, FLAME_LOW] });
  const scale = flicker.interpolate({ inputRange: [0, 1], outputRange: [1, FLAME_SQUAT] });

  return (
    <View
      testID="waiting-candle"
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityState={{ busy: true }}
      aria-busy
    >
      {/* The container is the whole control — it carries the progressbar role and the busy state.
          Both drawings leave the tree entirely: `no` would hide each `<Svg>` and leave its paths
          behind, so a wait announced itself as "progress bar" and then four unnamed shapes. */}
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        style={StyleSheet.absoluteFill}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        aria-hidden
      >
        {WAX.map((d) => (
          <Path
            key={d}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        ))}
      </Svg>
      {/* The flame rides its own layer so the flicker touches nothing else. Under reduce-motion
          it is simply a flame that is not moving — a candle held still is still lit. */}
      <Animated.View
        testID="waiting-flame"
        style={[StyleSheet.absoluteFill, animate && { opacity, transform: [{ scale }], transformOrigin: WICK }]}
      >
        <Svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          aria-hidden
        >
          <Path d={FLAME} fill={color} />
        </Svg>
      </Animated.View>
    </View>
  );
}
