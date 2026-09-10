import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

interface Props extends Omit<TextProps, 'style' | 'children'> {
  value: number;
  style?: StyleProp<TextStyle>;
  /** Renders the (integer) number shown at each frame. Defaults to `n.toLocaleString()`. */
  format?: (n: number) => string;
  /** Milliseconds for the tick from the previous value to the new one. */
  duration?: number;
}

const defaultFormat = (n: number) => n.toLocaleString();

/**
 * A number that ticks from its old value to its new one instead of jumping.
 *
 * Games never let a number cut: a score of 1,240 becoming 1,265 rolls through the values in
 * between, and that roll is what makes the change feel like something that *happened* rather than
 * a fact that was quietly corrected. The first render shows the value as-is — nothing counts up
 * from zero on mount — and every later change eases out over `duration`. Under a vfx level with
 * no motion (`still`, `off`) the final value is shown at once.
 *
 * Screen readers are given the final value as the label, so they never announce a frame.
 */
export function CountText({ value, style, format = defaultFormat, duration = 600, ...rest }: Props) {
  const level = useVfxLevel();
  const animate = motionAllowed(level);
  const anim = useRef(new Animated.Value(value)).current;
  const [shown, setShown] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;

    if (!animate) {
      anim.setValue(value);
      setShown(value);
      return;
    }

    // Values are rounded per frame; the listener is what writes the frames into React state,
    // which is the one route that renders reliably on native, web and under Jest alike.
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    const tick = Animated.timing(anim, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    tick.start(({ finished }) => {
      anim.removeListener(id);
      if (finished) setShown(value);
    });
    return () => {
      anim.removeListener(id);
      tick.stop();
    };
  }, [value, animate, duration, anim]);

  const displayed = animate ? shown : value;

  return (
    <Text {...rest} style={style} accessibilityLabel={format(Math.round(value))}>
      {format(displayed)}
    </Text>
  );
}
