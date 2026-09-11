import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * The soft keyboard's height on Android, 0 when it is hidden or on any other platform.
 *
 * `KeyboardAvoidingView` cannot be trusted on Android under edge-to-edge: its `height` behaviour
 * never restored the frame after the keyboard closed, and `padding` left the composer lifted by
 * the status bar plus the navigation bar, because the hide event's coordinates and the view's
 * frame are measured in different spaces. The keyboard events themselves are right, so a screen
 * pads by this value instead and lets the avoider do nothing there.
 */
export function useAndroidKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return height;
}
