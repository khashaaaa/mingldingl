import { Tabs } from 'expo-router';
import { type Tab, TabBar } from '@/design/components/TabBar';
import { t, useLocale } from '@/lib/i18n';
import { localeScreenLayout } from '@/lib/i18n/LocaleScreens';

/** Switching tabs never stacks screens: back from a tab returns to the first, not a history. */
export const unstable_settings = { initialRouteName: 'character' };

const TABS = [
  { key: 'seek', label: 'tab.seek', glyph: 'fire' },
  { key: 'quests', label: 'tab.quests', glyph: 'letters' },
  { key: 'missions', label: 'tab.missions', glyph: 'scroll' },
  { key: 'square', label: 'tab.square', glyph: 'stage' },
  { key: 'character', label: 'tab.character', glyph: 'person' },
] as const satisfies readonly Tab[];

export default function WorldTabs() {
  // The bar is the navigator's, not a screen's: it redraws its labels itself when the language changes.
  useLocale();
  return (
    <Tabs
      screenLayout={localeScreenLayout}
      backBehavior="initialRoute"
      initialRouteName="character"
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }}
      tabBar={({ state, navigation }) => (
        <TabBar
          tabs={TABS.map((tab) => ({ ...tab, label: t(tab.label) }))}
          active={state.routes[state.index]?.name ?? 'character'}
          onPress={(key) => {
            const route = state.routes.find((r) => r.name === key);
            if (!route) return;
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!event.defaultPrevented && state.routes[state.index]?.key !== route.key)
              navigation.navigate(route.name);
          }}
        />
      )}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.key} name={tab.key} />
      ))}
    </Tabs>
  );
}
