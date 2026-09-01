import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Every onboarding step pins its Back/Next row to the bottom with `marginTop: auto`, which on a
 * short screen (or with the keyboard up) used to push the buttons out of reach with nothing to
 * scroll. `flexGrow: 1` keeps the pinned row where it is while letting the content scroll once it
 * outgrows the viewport, and `keyboardShouldPersistTaps="handled"` lets a button take the first
 * tap instead of it being spent dismissing the keyboard.
 */
export function StepScaffold({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      // KeyboardAvoidingView measures its own frame relative to its parent, so the offset has to
      // be the screen-space origin of that parent — here, the root SafeAreaView's top edge.
      keyboardVerticalOffset={insets.top}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});
