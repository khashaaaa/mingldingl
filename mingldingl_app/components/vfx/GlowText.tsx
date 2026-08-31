import { useEffect, useRef } from 'react';
import { Animated, type TextProps } from 'react-native';
import { COLORS } from '../../lib/theme';
import { useVfxLevel } from '../../lib/vfx';

interface Props extends TextProps {
  color?: string;
}

export function GlowText({ style, color = COLORS.gold, children, ...rest }: Props) {
  const level = useVfxLevel();
  const pulse = useRef(new Animated.Value(6)).current;

  useEffect(() => {
    if (level === 'off') return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 16, duration: 1500, useNativeDriver: false }),
      Animated.timing(pulse, { toValue: 6, duration: 1500, useNativeDriver: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [level]);

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
