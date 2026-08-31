import { Keyboard, Platform, TouchableWithoutFeedback } from 'react-native';
import type { ReactElement } from 'react';

export function DismissKeyboardView({ children }: { children: ReactElement }) {
  if (Platform.OS === 'web') return children;
  return <TouchableWithoutFeedback onPress={Keyboard.dismiss}>{children}</TouchableWithoutFeedback>;
}
