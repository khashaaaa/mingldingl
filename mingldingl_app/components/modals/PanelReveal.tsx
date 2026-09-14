import { useRef, useEffect } from 'react';
import { Animated } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

interface Props {
  children: React.ReactNode;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function PanelReveal({ children, delay = 0, style }: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const animate = motionAllowed(useVfxLevel());

  useEffect(() => {
    if (!animate) {
      // Still: the panel is simply there, in its resting place.
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    const run = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 250, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 250, delay, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [animate, delay, opacity, translateY]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
