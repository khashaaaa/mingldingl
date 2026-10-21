import { Tabs } from 'expo-router';
import { type ComponentProps, useEffect, useRef } from 'react';
import { type Tab, TabBar } from '@/design/components/TabBar';
import { t, useLocale } from '@/lib/i18n';
import { localeScreenLayout } from '@/lib/i18n/LocaleScreens';

/** Switching tabs never stacks screens: back from a tab returns to the first, not a history. */
export const unstable_settings = { initialRouteName: 'character' };

const TABS = [
  { key: 'seek', label: 'tab.seek', glyph: 'fire' },
  { key: 'quests', label: 'tab.quests', glyph: 'letters' },
  { key: 'missions', label: 'tab.missions', glyph: 'forge' },
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
        <>
          <Preload state={state} navigation={navigation} />
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
        </>
      )}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.key} name={tab.key} />
      ))}
    </Tabs>
  );
}

/** How long the world settles before the next tab is drawn out of sight, one at a time. */
const PRELOAD_GAP_MS = 400;

/**
 * Draws every tab out of sight soon after the world opens, so a tab's first visit is already
 * fetched and painted. A tab first drawn on its visit showed an empty room that filled piece by
 * piece over the room it left; from the second visit on it was instant.
 */
function Preload({ state, navigation }: Pick<BarProps, 'state' | 'navigation'>) {
  // A tab once drawn or visited stays mounted, though it leaves the preloaded list on its visit.
  const drawn = useRef(new Set<string>());
  const here = state.routes[state.index];
  if (here) drawn.current.add(here.key);
  const next = state.routes.find((r) => !drawn.current.has(r.key));
  useEffect(() => {
    if (!next) return;
    const timer = setTimeout(() => {
      drawn.current.add(next.key);
      navigation.preload(next.name);
    }, PRELOAD_GAP_MS);
    return () => clearTimeout(timer);
  }, [next, navigation]);
  return null;
}

type BarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];
