import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type TextProps } from 'react-native';
import { ACCENT } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

interface Props extends TextProps {
  color?: string;
}

/** The glow's two radii: the dim breath it always has, and the bright one it swells to. */
const DIM_RADIUS = 6;
const BRIGHT_RADIUS = 16;

/**
 * Text that breathes a glow. The breath is a second copy of the text carrying the bright shadow,
 * faded in and out over the first on the UI thread. It used to animate `textShadowRadius` itself,
 * which no native driver can run: every frame crossed from JS and re-laid-out the text — on the
 * sign-in screen, under the field people are typing their number into.
 */
export function GlowText({ style, color = ACCENT.base, children, ...rest }: Props) {
  const level = useVfxLevel();
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // `still` keeps the glow — a light has a still form — and only stops it breathing, held at
    // the midpoint of the pulse rather than at its dimmest.
    if (!motionAllowed(level)) {
      breath.setValue(level === 'off' ? 0 : 0.5);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breath, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(breath, { toValue: 0, duration: 1500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [level, breath]);

  if (level === 'off') {
    return <Animated.Text style={style} {...rest}>{children}</Animated.Text>;
  }

  const shadow = (radius: number) => ({ textShadowColor: color, textShadowRadius: radius, textShadowOffset: { width: 0, height: 0 } });
  return (
    <View>
      <Animated.Text style={[style, shadow(DIM_RADIUS)]} {...rest}>{children}</Animated.Text>
      <Animated.Text
        style={[style, shadow(BRIGHT_RADIUS), StyleSheet.absoluteFill, { opacity: breath }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {children}
      </Animated.Text>
    </View>
  );
}
