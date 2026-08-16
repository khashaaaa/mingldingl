import { Keyboard, Platform, TouchableWithoutFeedback } from 'react-native';
import type { ReactElement } from 'react';

// On web, TouchableWithoutFeedback's press responder calls preventDefault on
// pointerdown, which cancels the browser's default "focus input on mousedown"
// behavior for any TextInput nested inside it — so wrapped inputs never gain
// focus on click. There's no on-screen keyboard to dismiss on web anyway, so
// skip the wrapper there and keep it for native, where it works correctly.
export function DismissKeyboardView({ children }: { children: ReactElement }) {
  if (Platform.OS === 'web') return children;
  return <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{children}</TouchableWithoutFeedback>;
}
