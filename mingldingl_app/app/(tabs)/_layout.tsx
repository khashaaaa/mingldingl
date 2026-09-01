import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../lib/theme';
import { Icon } from '../../components/ui/Icon';
import { i18n } from '../../lib/i18n';
import { useLocaleStore } from '../../store/localeStore';

type TabGlyph = React.ComponentProps<typeof Icon>['name'];

/**
 * The label goes through React Navigation's own label slot rather than being drawn inside
 * `tabBarIcon`. The icon slot is sized to the glyph (~31px against an 84px tab), so a label
 * nested in it resolved `width: '100%'` against 31px and clipped every tab to "Se…"/"Ха…".
 */
const tabIcon = (glyph: TabGlyph) => ({ color }: { color: string }) => (
  <Icon name={glyph} size={22} color={color} style={styles.glyph} />
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
        tabBarStyle: [styles.tabBar, { height: 68 + insets.bottom, paddingBottom: 6 + insets.bottom }],
        tabBarActiveTintColor: COLORS.goldBright,
        tabBarInactiveTintColor: COLORS.textDim,
        // Without this the label is laid out beside the icon on wide viewports and the two
        // collide inside a 84px tab.
        tabBarLabelPosition: 'below-icon',
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}
    >
      <Tabs.Screen name="discover"
        options={{ title: i18n.t('tab_seek'), tabBarIcon: tabIcon('sword') }} />
      <Tabs.Screen name="matches"
        options={{ title: i18n.t('tab_quest_log'), tabBarIcon: tabIcon('script-text') }} />
      <Tabs.Screen name="townsquare"
        options={{ title: i18n.t('tab_town_square'), tabBarIcon: tabIcon('bank') }} />
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
    borderTopColor: COLORS.bronze,
    paddingTop: 6,
  },
  item: { paddingHorizontal: 2 },
  glyph: { textAlign: 'center' },
  label: {
    fontFamily: FONTS.display,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.5,
    textAlign: 'center',
  },
});
