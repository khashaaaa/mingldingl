import { useEffect, useRef } from 'react';
import { Animated, type TextProps } from 'react-native';
import { COLORS } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

interface Props extends TextProps {
  color?: string;
}

export function GlowText({ style, color = COLORS.gold, children, ...rest }: Props) {
  const level = useVfxLevel();
  const pulse = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    // `still` keeps the glow — a light has a still form — and only stops it breathing, held at
    // the midpoint of the pulse rather than at its dimmest.
    if (!motionAllowed(level)) {
      pulse.setValue(level === 'off' ? 6 : 11);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 16, duration: 1500, useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 6, duration: 1500, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [level, pulse]);

  if (level === 'off') {
    return <Animated.Text style={style} {...rest}>{children}</Animated.Text>;
  }

  return (
    <Animated.Text
      style={[style, { textShadowColor: color, textShadowRadius: pulse, textShadowOffset: { width: 0, height: 0 } }]}
      {...rest}
    >
      {children}
    </Animated.Text>
  );
}
