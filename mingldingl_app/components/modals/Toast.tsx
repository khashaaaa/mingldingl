import { useCallback, useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { ACCENT, RADIUS, SPACE, SURFACE, glow } from '../../lib/theme';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

interface ToastMotion {
  visible: boolean;
  /** Where the card rests when hidden: negative slides in from the top, positive from the bottom. */
  offset: number;
  /** How long it stays before it leaves on its own. */
  holdMs: number;
  onDismiss: () => void;
  /** Extra values that ride the same entrance/exit (the loot toast's pop and rays). */
  enter?: () => Animated.CompositeAnimation[];
  exit?: () => Animated.CompositeAnimation[];
  /** Set those extras to their final, shown values — the still form, under reduce motion. */
  settle?: () => void;
  /** Put those extras back to their hidden values once the card has gone. */
  reset?: () => void;
}

/**
 * The slide, fade and auto-dismiss both toasts share. `LootToast` and `NudgeToast` carried
 * near-identical copies of this, and neither honoured reduce motion: under `still` the card simply
 * appears in place and leaves without travelling.
 *
 * Every caller passes inline arrows, so they are read through a ref — the timer stays keyed on
 * `visible` alone instead of restarting on the parent's every render.
 */
export function useToastMotion({ visible, offset, holdMs, onDismiss, enter, exit, settle, reset }: ToastMotion) {
  const animate = motionAllowed(useVfxLevel());
  const translateY = useRef(new Animated.Value(offset)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hooks = useRef({ onDismiss, enter, exit, settle, reset });
  hooks.current = { onDismiss, enter, exit, settle, reset };

  const hide = useCallback(() => {
    const done = () => {
      hooks.current.reset?.();
      hooks.current.onDismiss();
    };
    if (!animate) {
      translateY.setValue(offset);
      opacity.setValue(0);
      done();
      return;
    }
    Animated.parallel([
      Animated.timing(translateY, { toValue: offset, duration: 300, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ...(hooks.current.exit?.() ?? []),
    ]).start(done);
  }, [animate, offset, translateY, opacity]);

  useEffect(() => {
    if (!visible) return;
    if (animate) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 12, stiffness: 180 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        ...(hooks.current.enter?.() ?? []),
      ]).start();
    } else {
      translateY.setValue(0);
      opacity.setValue(1);
      hooks.current.settle?.();
    }
    const t = setTimeout(hide, holdMs);
    return () => clearTimeout(t);
  }, [visible, animate, holdMs, hide, translateY, opacity]);

  return { translateY, opacity, hide };
}

/** The card both toasts are drawn on: a panel edged and lit in the accent. */
export const TOAST_STYLES = StyleSheet.create({
  container: { position: 'absolute', left: SPACE.gutter, right: SPACE.gutter },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    backgroundColor: SURFACE.panel,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: ACCENT.base,
    ...glow(ACCENT.base, 0.3, 20, 10),
  },
});
