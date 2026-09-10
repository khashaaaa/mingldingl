import { Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, INK, LINE, LINE_HEIGHTS, SPACE } from '../../lib/theme';
import { Icon } from '../../components/ui/Icon';
import { i18n } from '../../lib/i18n';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';
import { useLocaleStore } from '../../store/localeStore';

type TabGlyph = React.ComponentProps<typeof Icon>['name'];

/**
 * The label goes through React Navigation's own label slot rather than being drawn inside
 * `tabBarIcon`. The icon slot is sized to the glyph (~31px against an 84px tab), so a label
 * nested in it resolved `width: '100%'` against 31px and clipped every tab to "Se…"/"Ха…".
 */
const TabGlyphIcon = ({ glyph, color, focused }: { glyph: TabGlyph; color: string; focused: boolean }) => {
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
      <Icon name={glyph} size={ICON_SIZES.xl} color={color} style={styles.glyph} />
    </Animated.View>
  );
};

const tabIcon = (glyph: TabGlyph) => ({ color, focused }: { color: string; focused: boolean }) => (
  <TabGlyphIcon glyph={glyph} color={color} focused={focused} />
);

export default function TabsLayout() {
  // The tab labels are baked into the options objects below, so React Navigation keeps serving
  // the strings from this component's last render. Subscribing re-renders it on a locale switch.
  useLocaleStore((s) => s.locale);
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: 74 + insets.bottom, paddingBottom: SPACE.md + insets.bottom }],
        tabBarActiveTintColor: COLORS.goldBright,
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
        options={{ title: i18n.t('tab_seek'), tabBarIcon: tabIcon('compass-rose') }} />
      <Tabs.Screen name="matches"
        options={{ title: i18n.t('tab_quest_log'), tabBarIcon: tabIcon('message-text') }} />
      <Tabs.Screen name="townsquare"
        options={{ title: i18n.t('tab_town_square'), tabBarIcon: tabIcon('account-group') }} />
      <Tabs.Screen name="activity"
        options={{ title: i18n.t('tab_missions'), tabBarIcon: tabIcon('sword-cross') }} />
      <Tabs.Screen name="profile"
        options={{ title: i18n.t('tab_character'), tabBarIcon: tabIcon('shield') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.panelDeep,
    borderTopWidth: 1,
    borderTopColor: LINE.edge,
    paddingTop: SPACE.sm,
  },
  scene: { backgroundColor: 'transparent' },
  item: { paddingHorizontal: SPACE.hair },
  glyph: { textAlign: 'center' },
  label: {
    fontFamily: FONTS.display,
    // xs, not sm: the display face's small caps are wide, and at sm a nine-character Mongolian
    // label ("Тэмдэглэл", "Даалгавар") overran a 78dp tab and rendered as "ТЭМДЭГЛ…".
    fontSize: FONT_SIZES.xs,
    // Full leading, not the snug `xs` step: the display face has a descending `Q` and `g`, and
    // "Quest Log" had both of them sheared flat against the bottom of the bar.
    lineHeight: LINE_HEIGHTS.sm,
    // 0.5 pushed the widest label ("Character", "Тохиргоо") to the screen edge inside an 86px tab.
    letterSpacing: 0.2,
    textAlign: 'center',
  },
});
