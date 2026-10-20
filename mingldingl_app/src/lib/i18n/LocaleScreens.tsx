import { Fragment, type ReactElement } from 'react';
import { useLocale } from './index';

/**
 * Screens call `t()` while they render, and React Navigation keeps a mounted screen from
 * re-rendering, so a language change would leave every open screen in the old one. Keyed by the
 * language, a switch remounts the screens; a navigator is never remounted (that would forget which
 * tab is open), so every navigator takes this layout for its own screens. Form drafts on screen are
 * lost — the price of a rare switch.
 */
function LocaleKeyed({ children }: { children: ReactElement }) {
  const locale = useLocale();
  return <Fragment key={locale}>{children}</Fragment>;
}

/**
 * A route named as a bare group, `(world)`, is a folder with its own `_layout`: a navigator, passed
 * through untouched (expo-router does not put the nested state on the route to tell by). A group
 * without a layout shows up as `(closed)/index`, a screen.
 */
const isNavigatorRoute = (name: string) => /^\([^/]+\)$/.test(name);

/** Every navigator's `screenLayout`. */
export const localeScreenLayout = ({
  route,
  children,
}: {
  route: { name: string };
  children: ReactElement;
}) => (isNavigatorRoute(route.name) ? children : <LocaleKeyed>{children}</LocaleKeyed>);
