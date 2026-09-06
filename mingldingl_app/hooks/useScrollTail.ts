import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SPACE } from '../lib/theme';

/**
 * Bottom padding for a screen's scroll content.
 *
 * The root SafeAreaView only claims the top edge — the world floor has to paint behind the
 * navigation bar — so every pushed screen owns its own bottom inset. `SPACE.scrollTail` alone is
 * a 40px guess that a 48dp three-button navigation bar eats: "SIGN OUT", "SAVE" and "RENEW GOLD"
 * were all clipped by it on a Redmi. The tab bar and the chat composer add `insets.bottom` the
 * same way; this is that rule for scroll content.
 */
export function useScrollTail(): number {
  const insets = useSafeAreaInsets();
  return SPACE.scrollTail + insets.bottom;
}
