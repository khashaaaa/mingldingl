import { Keyboard, Platform, TouchableWithoutFeedback } from 'react-native';
import type { ReactElement } from 'react';

/**
 * Tap anywhere to close the keyboard, for a screen that does not scroll. Never wrap a ScrollView in
 * it: the touchable claims the gesture first and most swipes never scroll (Edit Your Character did
 * this). A ScrollView does the same job with `keyboardShouldPersistTaps="handled"` and
 * `keyboardDismissMode="on-drag"`.
 */
export function DismissKeyboardView({ children }: { children: ReactElement }) {
  if (Platform.OS === 'web') return children;
  return <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{children}</TouchableWithoutFeedback>;
}
