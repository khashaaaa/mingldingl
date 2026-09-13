import { View, StyleSheet } from 'react-native';
import { HeaderBar } from '../components/ui/HeaderBar';
import { i18n } from '../lib/i18n';
import { ROOMS } from '../lib/world/rooms';

/**
 * Placeholder. This is the way home the hearth tap (`HeaderBar`) already points at from Task 4
 * onward, so the route has to exist before its own screen does — Task 5 replaces the body below
 * with the hearth itself (the fires, the candle row, the destinations). Title is the room's own
 * name, the same name a screen reader hears for every route this room owns.
 */
export default function HearthScreen() {
  return (
    <View style={styles.screen}>
      <HeaderBar title={i18n.t(ROOMS.hearth.key)} showBack={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Transparent: the world floor paints behind every screen, an opaque container would hide it.
  screen: { flex: 1, backgroundColor: 'transparent' },
});
