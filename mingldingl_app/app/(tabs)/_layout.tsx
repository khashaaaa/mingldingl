import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../lib/theme';
import { Icon } from '../../components/ui/Icon';
import { i18n } from '../../lib/i18n';

type TabGlyph = React.ComponentProps<typeof Icon>['name'];

function TabIcon({ glyph, label, focused }: { glyph: TabGlyph; label: string; focused: boolean }) {
  const color = focused ? COLORS.goldBright : COLORS.textDim;
  return (
    <View style={styles.iconWrap}>
      <Icon name={glyph} size={22} color={color} style={styles.glyph} />
      <Text
        style={[styles.label, { color }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {label}
      </Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: [styles.tabBar, { height: 60 + insets.bottom, paddingBottom: 8 + insets.bottom }],
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen name="discover"
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="sword" label={i18n.t('tab_seek')} focused={focused} /> }} />
      <Tabs.Screen name="matches"
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="script-text" label={i18n.t('tab_quest_log')} focused={focused} /> }} />
      <Tabs.Screen name="townsquare"
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="bank" label={i18n.t('tab_town_square')} focused={focused} /> }} />
      <Tabs.Screen name="activity"
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="sword-cross" label={i18n.t('tab_missions')} focused={focused} /> }} />
      <Tabs.Screen name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="shield" label={i18n.t('tab_character')} focused={focused} /> }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.panelDeep,
    borderTopWidth: 1,
    borderTopColor: COLORS.bronze,
    paddingTop: 8,
  },
  iconWrap: { alignItems: 'center', gap: 2, minWidth: 72 },
  glyph: { height: 24, lineHeight: 24, textAlign: 'center' },
  label: {
    fontFamily: FONTS.display,
    fontSize: 11,
    lineHeight: 14,
    height: 14,
    letterSpacing: 1,
    width: '100%',
    textAlign: 'center',
  },
});
