import { Tabs } from 'expo-router';
import { Text, View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS } from '../../lib/theme';
import { i18n } from '../../lib/i18n';

function TabIcon({ glyph, label, focused }: { glyph: string; label: string; focused: boolean }) {
  const color = focused ? COLORS.goldBright : COLORS.textDim;
  return (
    <View style={styles.iconWrap}>
      <Text style={[styles.glyph, { opacity: focused ? 1 : 0.45 }]}>{glyph}</Text>
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
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="🗡" label={i18n.t('tab_seek')} focused={focused} /> }} />
      <Tabs.Screen name="matches"
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="📜" label={i18n.t('tab_quest_log')} focused={focused} /> }} />
      <Tabs.Screen name="townsquare"
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="🏛" label={i18n.t('tab_town_square')} focused={focused} /> }} />
      <Tabs.Screen name="activity"
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="⚔️" label={i18n.t('tab_missions')} focused={focused} /> }} />
      <Tabs.Screen name="profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon glyph="🛡" label={i18n.t('tab_character')} focused={focused} /> }} />
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
  // Fixed box (not just fontSize) so all four tab glyphs line up identically
  // regardless of a given character's natural metrics — text-presentation
  // symbols in particular render narrower/shorter than full emoji at the same
  // font size, which is what made one tab look off before.
  glyph: { fontSize: 20, lineHeight: 24, height: 24, width: 24, textAlign: 'center', color: COLORS.gold },
  // width: '100%' (not just the Text shrink-wrapping to content) so
  // numberOfLines={1}'s ellipsis/adjustsFontSizeToFit has an actual box to
  // measure against — longer-language labels (e.g. Mongolian "Аяны
  // тэмдэглэл" for Quest Log) were wrapping onto a second line and making
  // that one tab visibly taller than its neighbors instead of shrinking or
  // truncating in place.
  // height + lineHeight are fixed for the same reason `glyph` already fixes
  // its own box (see that comment): adjustsFontSizeToFit shrinks a label
  // whose text is too wide, and a shrunk font has a shorter natural line
  // height — without a fixed box, that tab's glyph+label stack ends up
  // shorter than its neighbors' and centers a few px lower/higher than the
  // rest of the tab bar.
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
