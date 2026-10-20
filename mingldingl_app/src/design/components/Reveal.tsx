import type { ReactNode } from 'react';
import { Children, isValidElement, useEffect, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { curve, MOTION, useReduceMotion } from '../motion';

/** Gap between siblings revealed in turn. */
const STAGGER = 90;

/**
 * Ink bleed-in (Figma motion "Ink bleed-in"): what it holds rises a few points and bleeds in from
 * nothing. `order` reveals siblings one after another; a new `key` plays it again.
 */
export function Reveal({
  children,
  order = 0,
  delay = 0,
  rise = 10,
  style,
}: {
  children: ReactNode;
  order?: number;
  delay?: number;
  rise?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const m = MOTION.inkBleedIn;
  const p = useSharedValue(0);
  useEffect(() => {
    const ms = reduce ? m.exit : m.duration;
    p.value = withDelay(delay + order * STAGGER, withTiming(1, { duration: ms, easing: curve(m.easing) }));
  }, [p, reduce, delay, order]);
  const a = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: reduce ? [] : [{ translateY: (1 - p.value) * rise }, { scale: 0.97 + 0.03 * p.value }],
  }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Rows past this one arrive together: a long list never makes the reader wait for its tail. */
const CASCADE_MAX = 7;

/**
 * A list that ink-bleeds in row after row the first time it is shown. Rows that join it later
 * (a new letter, a new deed) bleed in at once, in place — never behind the rows already there.
 */
export function Cascade({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const settled = useRef(false);
  // Each row keeps the turn it was first given, so a re-render mid-cascade never cuts it short.
  const turns = useRef(new Map<unknown, number>());
  useEffect(() => {
    settled.current = true;
  }, []);
  let i = 0;
  return (
    <>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        let turn = turns.current.get(child.key);
        if (turn === undefined) {
          turn = settled.current ? -1 : Math.min(i++, CASCADE_MAX);
          turns.current.set(child.key, turn);
        }
        return (
          <Reveal key={child.key} order={Math.max(0, turn)} delay={turn < 0 ? 0 : delay} rise={6}>
            {child}
          </Reveal>
        );
      })}
    </>
  );
}
