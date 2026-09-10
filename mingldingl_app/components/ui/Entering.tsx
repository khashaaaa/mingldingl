import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing } from 'react-native';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

export const STAGGER_MS = 40;
/** Rows past this arrive at rest — a long list must not animate a tail nobody is looking at. */
export const ENTER_CAP = 8;
const RISE_PX = 8;
const FADE_MS = 260;

interface Props {
  index: number;
  children: ReactNode;
}

/**
 * A list row arriving: a short fade and an 8px rise, staggered by position, as if the rows were
 * lit one at a time.
 *
 * First mount only. Re-running on every refetch would make pull-to-refresh flicker the whole
 * list, which is why the animation lives in a `useRef` guard rather than keying off the data.
 */
export function Entering({ index, children }: Props) {
  const level = useVfxLevel();
  const animate = motionAllowed(level) && index < ENTER_CAP;
  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const started = useRef(false);

  useEffect(() => {
    if (!animate || started.current) return;
    started.current = true;
    Animated.timing(progress, {
      toValue: 1,
      duration: FADE_MS,
      delay: index * STAGGER_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [animate, index, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [RISE_PX, 0] });

  return (
    <Animated.View testID="entering" style={{ opacity: progress, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}
