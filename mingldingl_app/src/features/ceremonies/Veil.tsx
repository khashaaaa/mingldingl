import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { withAlpha } from '@/design/effects';
import { color } from '@/design/tokens';

/** A ceremony's dark veil over the floor (Figma: the night at 85 %), the moment held above it. */
export function Veil({ children }: { children: ReactNode }) {
  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.veil} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  veil: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: withAlpha(color.bgScrim, 0.85),
  },
});
