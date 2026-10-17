import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RevealContext } from '@/design/components/reveal';
import { dimension } from '@/design/tokens';

/** Room kept between a revealed field and the edge it would otherwise touch (the footer, the keys). */
const CLEARANCE = dimension.space5;

/**
 * One screen over the World Floor: an optional Room Header, a body (centred for ceremonies and
 * closed screens, top-aligned for forms) and the actions pinned at the foot, lifted by the keyboard.
 * A focused field is scrolled whole into the space left above the footer — on focus, and again when
 * the keyboard shrinks that space or the field grows. Transparent throughout — the floor is the background.
 */
export function Scene({
  header,
  children,
  footer,
  centered,
  keyboardOffset = 0,
  tabbed,
  bare,
}: {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  centered?: boolean;
  /**
   * Height drawn above this Scene by its parent (a header it does not own). The keyboard lift is
   * measured from the Scene's own frame, so without it the footer stays that much under the keys.
   */
  keyboardOffset?: number;
  /** Above the Tab Bar, which already keeps clear of the bottom inset. */
  tabbed?: boolean;
  /** The body scrolls itself (a letter list): no ScrollView around it. */
  bare?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const keys = useKeyboardUp();
  const frame = useRef<View>(null);
  const scroll = useRef<ScrollView>(null);
  const offset = useRef(0);
  const field = useRef<View | null>(null);

  const fit = useCallback(() => {
    const node = field.current;
    if (!node || !frame.current) return;
    frame.current.measureInWindow((_x, top, _w, height) =>
      node.measureInWindow((_nx, y, _nw, h) => {
        const bottom = top + height - CLEARANCE;
        // Taller than the space: show its top (the label and where typing starts).
        const by = y < top + CLEARANCE || h > bottom - top - CLEARANCE ? y - top - CLEARANCE : y + h - bottom;
        if (y + h > bottom || y < top + CLEARANCE)
          scroll.current?.scrollTo({ y: Math.max(0, offset.current + by), animated: true });
      }),
    );
  }, []);
  const reveal = useCallback(
    (node: View | null) => {
      field.current = node;
      if (node) requestAnimationFrame(fit);
    },
    [fit],
  );

  return (
    <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={keyboardOffset} style={styles.screen}>
      {header ?? <View style={{ height: insets.top }} />}
      <View ref={frame} style={styles.frame} onLayout={() => requestAnimationFrame(fit)}>
        {bare ? (
          <View style={styles.frame}>{children}</View>
        ) : (
          <RevealContext.Provider value={reveal}>
            <ScrollView
              ref={scroll}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={16}
              onScroll={(e) => {
                offset.current = e.nativeEvent.contentOffset.y;
              }}
              contentContainerStyle={[styles.body, centered && styles.centered]}
            >
              {children}
            </ScrollView>
          </RevealContext.Provider>
        )}
      </View>
      {footer ? (
        // The keys cover the bottom inset; keeping it lifted the footer over the next field (Born).
        <View
          style={[
            styles.footer,
            { paddingBottom: keys ? dimension.space3 : insets.bottom + dimension.space5 },
          ]}
        >
          {footer}
        </View>
      ) : tabbed ? null : (
        <View style={{ height: insets.bottom }} />
      )}
    </KeyboardAvoidingView>
  );
}

function useKeyboardUp() {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setUp(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setUp(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return up;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  frame: { flex: 1 },
  body: {
    flexGrow: 1,
    paddingHorizontal: dimension.sizeGutter,
    paddingTop: dimension.space3,
    gap: dimension.space4,
  },
  centered: { justifyContent: 'center', alignItems: 'center' },
  footer: {
    paddingHorizontal: dimension.sizeGutter,
    paddingTop: dimension.space3,
    gap: dimension.space2,
    alignItems: 'center',
  },
});
