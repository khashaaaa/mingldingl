import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native';
import { useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { SCENES, useRoomScene, type SceneName } from '../vfx/scenes';
import { Waiting } from './Waiting';
import { signal } from '../../lib/world/feedback';
import { ICON_SIZES } from '../../lib/theme';
import { useVfxLevel } from '../../lib/vfx';

/**
 * Pull-to-refresh without the platform's control, painted with the room's scene (`ROOM_SCENES`):
 * the pull is the scene's `gather`, the fetch its `active`, and the let-go its `settle`.
 *
 * Without the platform's control: `RefreshControl` draws Material's spinning arc
 * in a white disc on Android, and nothing on these screens may come from somebody else's design.
 *
 * No gesture is intercepted: the list simply starts scrolled one `HEARTH` down, and the hearth is
 * the first thing in its content. Pulling the list down is ordinary native scrolling into the
 * hearth — the fire is laid as it comes into view — and `snapToOffsets` settles a release either
 * shut (back to `HEARTH`) or fully open, which is the pull that kindles it. It works the same on
 * both platforms because it is only a scroll view, and Android's overscroll glow is turned off
 * so the list's edge is never Material's either.
 *
 * The fire burns at least `MIN_BURN_MS`, however fast the fetch, so the catch is always seen.
 */

export const HEARTH = 96;
const MIN_BURN_MS = 1100;
/** A release with the hearth at least this open kindles it (the snap then carries it the rest). */
const KINDLE_AT = HEARTH * 0.4;
const DOUSE_MS = 420;
const SMOKE_MS = 1000;

interface Options {
  onRefresh: () => unknown;
  /** The list's own content style; padding above is kept above the list, not above the hearth. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** The list's own scroll handler, still called on every scroll. */
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** The scene painted in the hearth; by default the room's own (`ROOM_SCENES`). */
  scene?: SceneName;
}

type Scrollable = {
  scrollTo?: (o: { y: number; animated?: boolean }) => void;
  scrollToOffset?: (o: { offset: number; animated?: boolean }) => void;
};

function paddingTopOf(style: StyleProp<ViewStyle>): number {
  const flat = StyleSheet.flatten(style) ?? {};
  const v = flat.paddingTop ?? flat.paddingVertical ?? flat.padding ?? 0;
  return typeof v === 'number' ? v : 0;
}

export function useKindle({ onRefresh, contentContainerStyle, onScroll, scene }: Options) {
  const roomScene = useRoomScene();
  const Scene = SCENES[scene ?? roomScene];
  const ref = useRef<Scrollable | null>(null);
  const laid = useSharedValue(0);
  const burn = useSharedValue(0);
  const smoke = useSharedValue(0);

  /** Lit from the kindling release until the fire has been let go. */
  const lit = useRef(false);
  const dragging = useRef(false);
  const caught = useRef(false);
  const lastY = useRef(HEARTH);
  const placed = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [viewport, setViewport] = useState(0);
  /** Whether the hearth has anything to draw — the canvas is only mounted while it does. */
  const [awake, setAwake] = useState(false);
  const awakeRef = useRef(false);

  const wake = useCallback((on: boolean) => {
    if (awakeRef.current === on) return;
    awakeRef.current = on;
    setAwake(on);
  }, []);

  const scrollTo = useCallback((y: number, animated = true) => {
    const list = ref.current;
    if (!list) return;
    if (list.scrollToOffset) list.scrollToOffset({ offset: y, animated });
    else list.scrollTo?.({ y, animated });
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const letGo = useCallback(() => {
    burn.value = withTiming(0, { duration: DOUSE_MS });
    smoke.value = 0;
    smoke.value = withTiming(1, { duration: SMOKE_MS });
    later(() => {
      lit.current = false;
      if (lastY.current < HEARTH) scrollTo(HEARTH);
    }, DOUSE_MS + 200);
    later(() => {
      smoke.value = 0;
      if (lastY.current >= HEARTH) {
        laid.value = 0;
        wake(false);
      }
    }, SMOKE_MS + 100);
  }, [burn, smoke, laid, later, scrollTo, wake]);

  const kindle = useCallback(() => {
    lit.current = true;
    wake(true);
    scrollTo(0);
    laid.value = withTiming(1, { duration: 120 });
    // The catch: a flare past full height, then settling into a fire.
    burn.value = withSequence(withTiming(1.3, { duration: 200 }), withSpring(1, { damping: 9, stiffness: 140 }));
    smoke.value = 0;
    if (!caught.current) signal('stoke');
    const wait = new Promise((resolve) => setTimeout(resolve, MIN_BURN_MS));
    Promise.all([Promise.resolve().then(onRefresh), wait]).catch(() => {}).finally(letGo);
  }, [onRefresh, letGo, scrollTo, wake, laid, burn, smoke]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    lastY.current = y;
    const open = Math.max(0, Math.min(1, (HEARTH - y) / HEARTH));
    if (open > 0) wake(true);
    if (!lit.current) {
      laid.value = open;
      if (dragging.current && open >= 0.98 && !caught.current) {
        caught.current = true;
        signal('stoke');
      }
      if (open < 0.6) caught.current = false;
      if (open === 0 && burn.value === 0 && smoke.value === 0) wake(false);
    }
    onScroll?.(e);
  }, [onScroll, wake, laid, burn, smoke]);

  const settle = useCallback(() => {
    later(() => {
      if (!lit.current && !dragging.current && lastY.current > 0.5 && lastY.current < HEARTH) scrollTo(HEARTH);
    }, 380);
  }, [later, scrollTo]);

  const onScrollBeginDrag = useCallback(() => { dragging.current = true; }, []);
  const onScrollEndDrag = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    dragging.current = false;
    const y = e.nativeEvent.contentOffset.y;
    if (!lit.current && y <= KINDLE_AT) kindle();
    else settle();
  }, [kindle, settle]);
  const onMomentumScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    lastY.current = e.nativeEvent.contentOffset.y;
    // A fling that lands in the hearth without anyone pulling it does not light it: it is shut.
    if (!lit.current && lastY.current < HEARTH) scrollTo(HEARTH);
  }, [scrollTo]);

  // The hearth is hidden by scrolling past it, which the list can only do once its content is a
  // hearth taller than the viewport — so the first placement waits for both measurements rather
  // than firing on the first content size and being clamped back to 0.
  const viewportRef = useRef(0);
  const contentRef = useRef(0);
  const place = useCallback(() => {
    if (placed.current || viewportRef.current === 0) return;
    if (contentRef.current < viewportRef.current + HEARTH - 1) return;
    placed.current = true;
    scrollTo(HEARTH, false);
  }, [scrollTo]);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    viewportRef.current = e.nativeEvent.layout.height;
    setViewport(e.nativeEvent.layout.height);
    place();
  }, [place]);
  const onContentSizeChange = useCallback((_w: number, h: number) => {
    contentRef.current = h;
    place();
  }, [place]);

  const pad = paddingTopOf(contentContainerStyle);
  const level = useVfxLevel();

  const header = (
    <View
      testID="kindle-hearth"
      style={[styles.hearth, { marginTop: -pad, marginBottom: pad }]}
      pointerEvents="none"
    >
      {awake && (level === 'full'
        ? <Scene height={HEARTH} gather={laid} active={burn} settle={smoke} />
        // No Skia canvas (web) or no motion wanted: the waiting candle holds the hearth instead.
        : <View style={styles.candle}><Waiting size={ICON_SIZES.xl} /></View>)}
    </View>
  );

  const scrollProps = useMemo(() => ({
    ref: (r: unknown) => { ref.current = r as Scrollable | null; },
    onScroll: handleScroll,
    scrollEventThrottle: 16,
    onScrollBeginDrag,
    onScrollEndDrag,
    onMomentumScrollEnd,
    onLayout,
    onContentSizeChange,
    contentOffset: { x: 0, y: HEARTH },
    snapToOffsets: [HEARTH],
    snapToEnd: false,
    overScrollMode: 'never' as const,
    contentContainerStyle: [contentContainerStyle, viewport > 0 && { minHeight: viewport + HEARTH }],
  }), [handleScroll, onScrollBeginDrag, onScrollEndDrag, onMomentumScrollEnd, onLayout, onContentSizeChange, contentContainerStyle, viewport]);

  return { scrollProps, header };
}

const styles = StyleSheet.create({
  hearth: { height: HEARTH, alignItems: 'center', justifyContent: 'flex-end' },
  candle: { height: HEARTH, justifyContent: 'center' },
});
