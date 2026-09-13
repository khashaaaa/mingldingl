import { View, StyleSheet } from 'react-native';
import { HeaderBar } from '../components/ui/HeaderBar';
import { i18n } from '../lib/i18n';
import { ROOMS } from '../lib/world/rooms';

/**
 * Placeholder. The Satchel lives in the hearth room (`lib/world/rooms.ts`) rather than a place of
 * its own on the atlas — it is what you carry *to* the hearth, not a room. Task 9 replaces the
 * body below with the nine rows; this only has to exist so the route-coverage test and the
 * header's hearth tap have somewhere real to land.
 */
export default function SatchelScreen() {
  return (
    <View style={styles.screen}>
      <HeaderBar title={i18n.t(ROOMS.hearth.key)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
});
