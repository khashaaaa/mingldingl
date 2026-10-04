import { useEffect, useRef } from 'react';
import { Animated, Easing, View, type StyleProp, type ViewStyle } from 'react-native';
import { Glyph, type GlyphName } from './Glyph';
import { GLYPH_DRAWS, GLYPH_DRAW_FRAMES } from './glyphImages';
import { ACCENT, ICON_SIZES } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { useInkBleeding } from '../vfx/inkBleedContext';

interface Props {
  name: GlyphName;
  size?: number;
  color?: string;
  /** How long the brush takes, start to seal. */
  duration?: number;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

/** The steps a strip of `GLYPH_DRAW_FRAMES` frames advances through: held on each frame, then a
 *  jump to the next, so the drawing never slides between two of them. */
function steps(size: number) {
  const input: number[] = [];
  const output: number[] = [];
  for (let f = 0; f < GLYPH_DRAW_FRAMES; f++) {
    input.push(f, f + 0.999);
    output.push(-f * size, -f * size);
  }
  return { inputRange: input, outputRange: output };
}

/**
 * A ceremony's glyph, painted in front of the viewer: the brush lays its strokes down in order and
 * presses its seals last, instead of the finished mark simply appearing. Baked as a strip of frames
 * (`scripts/gen-glyphs.js`, `DRAWN`) and stepped through on the native driver, so it costs what one
 * image costs. Under reduced motion, or for a glyph with no strip, it is the finished `Glyph`.
 * Inside an `InkBleed` the brush waits, its place left empty, until the bleed has settled.
 */
export function InkDraw({ name, size = ICON_SIZES.splash, color = ACCENT.base, duration = 900, delay = 0, style }: Props) {
  const animate = motionAllowed(useVfxLevel());
  const strip = GLYPH_DRAWS[name];
  const frame = useRef(new Animated.Value(0)).current;
  const waiting = useInkBleeding();

  useEffect(() => {
    if (!animate || !strip || waiting) return;
    frame.setValue(0);
    const run = Animated.timing(frame, {
      toValue: GLYPH_DRAW_FRAMES - 1,
      duration,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [animate, strip, frame, duration, delay, waiting]);

  if (!animate || !strip) return <Glyph name={name} size={size} color={color} style={style} />;
  if (waiting) return <View style={[{ width: size, height: size }, style]} />;

  return (
    <View
      testID={`ink-draw-${name}`}
      style={[{ width: size, height: size, overflow: 'hidden' }, style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.Image
        source={strip}
        fadeDuration={0}
        style={{
          width: size * GLYPH_DRAW_FRAMES,
          height: size,
          tintColor: color,
          transform: [{ translateX: frame.interpolate(steps(size)) }],
        }}
      />
    </View>
  );
}
