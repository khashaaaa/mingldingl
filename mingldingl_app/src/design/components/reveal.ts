import { createContext, useContext, useRef } from 'react';
import type { LayoutChangeEvent, View } from 'react-native';

/**
 * How a field asks the screen scrolling it to keep it in view: the whole field — label, frame,
 * counter, error — not only the line holding the cursor, which is all Android scrolls to on its own
 * (it left a field's lower edge under the Save button). `null` when the field lets go.
 */
export const RevealContext = createContext<(node: View | null) => void>(() => {});

/**
 * Wiring for one field: put `ref` and `onLayout` on its outer view and call `focus`/`blur` from the
 * input. A focused field that grows (a tale gaining lines) is revealed again.
 */
export function useReveal() {
  const reveal = useContext(RevealContext);
  const ref = useRef<View>(null);
  const focused = useRef(false);
  return {
    ref,
    onLayout: (_: LayoutChangeEvent) => {
      if (focused.current) reveal(ref.current);
    },
    focus: () => {
      focused.current = true;
      reveal(ref.current);
    },
    blur: () => {
      focused.current = false;
      reveal(null);
    },
  };
}
