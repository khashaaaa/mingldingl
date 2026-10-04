import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { usePathname } from 'expo-router';
import { BRUSH_WASH, BRUSH_WASH_FRAMES } from '../ui/brushImages';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { useInkWashStore } from '../../store/inkWashStore';

/** Ink spreading until the screen is covered. */
export const COVER_MS = 480;
/** Held covered a beat after the new room has arrived, before it is shown. */
const HOLD_MS = 220;
/** The longest the wash waits for the room it hides to arrive, so it can never hang. */
export const ARRIVAL_CAP_MS = 900;
/** The wash drawing back off the new room: slower than it came, as ink soaks rather than spills. */
const UNCOVER_MS = 700;

interface Props {
  /** `pass`: cover, call `onCovered`, uncover, call `onDone`. `cover`: cover and stay, then `onCovered`. */
  mode: 'pass' | 'cover';
  onCovered?: () => void;
  /** `pass` only: resolves when what `onCovered` started is on screen; the wash holds until then. */
  ready?: () => Promise<void>;
  onDone?: () => void;
}

/** Holds each frame of the strip, then jumps to the next, so the wash never slides between two. */
function steps(width: number) {
  const input: number[] = [];
  const output: number[] = [];
  for (let f = 0; f < BRUSH_WASH_FRAMES; f++) {
    input.push(f, f + 0.999);
    output.push(-f * width, -f * width);
  }
  return { inputRange: input, outputRange: output };
}

/**
 * A wash of ink over the whole screen, baked as a strip of frames (`scripts/gen-brush.js`) and
 * stepped through on the native driver: it costs what one image costs. Swallows touches while it
 * runs. Under reduced motion there is no wash; `onCovered` and `onDone` still fire, at once.
 */
export function InkWash({ mode, onCovered, ready, onDone }: Props) {
  const animate = motionAllowed(useVfxLevel());
  const frame = useRef(new Animated.Value(0)).current;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (animate || ran.current) return;
    ran.current = true;
    onCovered?.();
    onDone?.();
  }, [animate, onCovered, onDone]);

  useEffect(() => {
    if (!animate || !size || ran.current) return;
    ran.current = true;
    const last = BRUSH_WASH_FRAMES - 1;
    const cover = Animated.timing(frame, { toValue: last, duration: COVER_MS, easing: Easing.in(Easing.quad), useNativeDriver: true });
    cover.start(({ finished }) => {
      if (!finished) return;
      onCovered?.();
      if (mode === 'cover') { onDone?.(); return; }
      Promise.resolve(ready?.()).then(() => {
        Animated.sequence([
          Animated.delay(HOLD_MS),
          Animated.timing(frame, { toValue: 0, duration: UNCOVER_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]).start(() => onDone?.());
      });
    });
  }, [animate, size, frame, mode, onCovered, ready, onDone]);

  if (!animate) return null;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width > 0 && height > 0 && !size) setSize({ w: width, h: height });
  };

  return (
    <View style={styles.fill} onLayout={onLayout} testID="ink-wash" accessible={false}>
      {size && (
        <Animated.Image
          source={BRUSH_WASH}
          resizeMode="stretch"
          style={{ width: size.w * BRUSH_WASH_FRAMES, height: size.h, transform: [{ translateX: frame.interpolate(steps(size.w)) }] }}
        />
      )}
    </View>
  );
}

/**
 * The root layout's passage, run by `passThroughInk`. The ink draws back only once the navigator
 * has moved to a new path and painted it: a fixed hold drew back on the A51 before the chat had
 * mounted, onto the room being left.
 */
export function InkWashHost() {
  const job = useInkWashStore((s) => s.job);
  const clear = useInkWashStore((s) => s.clear);
  const path = usePathname();
  const pathNow = useRef(path);
  const waiter = useRef<{ from: string; arrive: () => void } | null>(null);
  const from = useRef(path);

  useEffect(() => {
    pathNow.current = path;
    if (waiter.current && path !== waiter.current.from) waiter.current.arrive();
  }, [path]);

  const onCovered = useCallback(() => {
    from.current = pathNow.current;
    job?.then();
  }, [job]);

  const ready = useCallback(() => new Promise<void>((resolve) => {
    const arrive = () => {
      clearTimeout(cap);
      waiter.current = null;
      // Two frames: one for the new room to commit, one for it to paint.
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    };
    const cap = setTimeout(arrive, ARRIVAL_CAP_MS);
    waiter.current = { from: from.current, arrive };
    if (pathNow.current !== from.current) arrive();
  }), []);

  if (!job) return null;
  return <InkWash key={job.id} mode="pass" onCovered={onCovered} ready={ready} onDone={clear} />;
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
});
