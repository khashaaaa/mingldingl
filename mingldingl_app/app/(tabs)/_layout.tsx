import { Tabs, useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Animated, Easing, InteractionManager, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, LINE_HEIGHTS, SPACE, SURFACE, TAB_BAR_HEIGHT, TRACKING } from '../../lib/theme';
import { Glyph, type GlyphName } from '../../components/ui/Glyph';
import { i18n } from '../../lib/i18n';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { useLocaleStore } from '../../store/localeStore';

/**
 * The label goes through React Navigation's own label slot rather than being drawn inside
 * `tabBarIcon`. The icon slot is sized to the glyph (~31px against an 84px tab), so a label
 * nested in it resolved `width: '100%'` against 31px and clipped every tab to "Se…"/"Ха…".
 */
const TabGlyphIcon = ({ glyph, color, focused }: { glyph: GlyphName; color: string; focused: boolean }) => {
  const animate = motionAllowed(useVfxLevel());
  const lit = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    if (!animate) {
      lit.setValue(focused ? 1 : 0);
      return;
    }
    Animated.timing(lit, {
      toValue: focused ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [focused, animate, lit]);

  const scale = lit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Glyph name={glyph} size={ICON_SIZES.xl} color={color} />
    </Animated.View>
  );
};

const tabIcon = (glyph: GlyphName) => ({ color, focused }: { color: string; focused: boolean }) => (
  <TabGlyphIcon glyph={glyph} color={color} focused={focused} />
);

/**
 * The tabs other than the one the app opens on, in the order they are built in the background.
 * A tab is otherwise built the first time it is tapped, and on the Galaxy A51 (2026-10-03) that
 * first tap froze the screen for 300-800ms while the whole tab's views were created.
 */
const PRELOAD: readonly Href[] = ['/(tabs)/matches', '/(tabs)/profile', '/(tabs)/activity', '/(tabs)/townsquare'];
/** Long enough after the tabs mount that the opening screen has finished its own first frames. */
const PRELOAD_START_MS = 1500;
/** Between tabs, so each build is its own short stall rather than one long one. */
const PRELOAD_GAP_MS = 600;

/**
 * Builds the other tabs one at a time while the user is still on the first, so tapping one later
 * only has to show it. Waits out any running interaction before each, and stops for good once the
 * list is done or the tabs unmount.
 */
function usePreloadTabs() {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let task: { cancel: () => void } | undefined;
    const next = (i: number) => {
      if (cancelled || i >= PRELOAD.length) return;
      timer = setTimeout(() => {
        task = InteractionManager.runAfterInteractions(() => {
          if (cancelled) return;
          // A backgrounded app has no frames to spare and no reason to build anything.
          if (AppState.currentState === 'active') router.prefetch(PRELOAD[i]);
          next(i + 1);
        });
      }, i === 0 ? PRELOAD_START_MS : PRELOAD_GAP_MS);
    };
    next(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      task?.cancel();
    };
  }, [router]);
}

export default function TabsLayout() {
  usePreloadTabs();
  // The tab labels are baked into the options objects below, so React Navigation keeps serving
  // the strings from this component's last render. Subscribing re-renders it on a locale switch.
  useLocaleStore((s) => s.locale);
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: TAB_BAR_HEIGHT + insets.bottom, paddingBottom: SPACE.md + insets.bottom }],
        tabBarActiveTintColor: ACCENT.bright,
        tabBarInactiveTintColor: INK.dim,
        // Without this the label is laid out beside the icon on wide viewports and the two
        // collide inside a 84px tab.
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
        // Same reason as the Stack's contentStyle: the tab scene has its own opaque ground that
        // would sit on top of the world floor.
        sceneStyle: styles.scene,
      }}
    >
      <Tabs.Screen name="discover"
        options={{ title: i18n.t('tab_seek'), tabBarIcon: tabIcon('fire') }} />
      <Tabs.Screen name="matches"
        options={{ title: i18n.t('tab_quest_log'), tabBarIcon: tabIcon('letters') }} />
      <Tabs.Screen name="townsquare"
        options={{ title: i18n.t('tab_town_square'), tabBarIcon: tabIcon('lantern') }} />
      <Tabs.Screen name="activity"
        options={{ title: i18n.t('tab_missions'), tabBarIcon: tabIcon('forge') }} />
      <Tabs.Screen name="profile"
        options={{ title: i18n.t('tab_character'), tabBarIcon: tabIcon('gem') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: SURFACE.sunken,
    borderTopWidth: 1,
    borderTopColor: LINE.edge,
    paddingTop: SPACE.sm,
  },
  scene: { backgroundColor: 'transparent' },
  item: { paddingHorizontal: SPACE.hair },
  label: {
    fontFamily: FONTS.display,
    // xs, not sm: the display face's small caps are wide, and at sm a nine-character Mongolian
    // label ("Тэмдэглэл", "Даалгавар") overran a 78dp tab and rendered as "ТЭМДЭГЛ…".
    fontSize: FONT_SIZES.xs,
    // Full leading, not the snug `xs` step: the display face has a descending `Q` and `g`, and
    // "Quest Log" had both of them sheared flat against the bottom of the bar.
    lineHeight: LINE_HEIGHTS.sm,
    // 0.5 pushed the widest label ("Character", "Тохиргоо") to the screen edge inside an 86px tab.
    letterSpacing: TRACKING.body,
    textAlign: 'center',
  },
});
