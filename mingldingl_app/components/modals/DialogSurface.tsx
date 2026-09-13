import { useContext } from 'react';
import { View, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { useAndroidKeyboardHeight } from '../../hooks/useAndroidKeyboardHeight';
import { ACCENT, LINE, RADIUS, SCRIM, SPACE, SURFACE, overlay } from '../../lib/theme';
import { ParchmentFill } from '../ui/ParchmentFill';

/**
 * How much of the app a layer is entitled to take over.
 *
 * `sheet` rises over a screen still meant to be read behind it; `dialog` asks a question, so
 * what is behind is context rather than content; `ceremony` is a tier-up or a chest, where
 * nothing behind it should compete; `strip` also asks a question, or reports a failure, but
 * keeps the room lit and does not dim it at all — the interruption is a note, not a takeover.
 */
export type DialogWeight = 'sheet' | 'dialog' | 'ceremony' | 'strip';

/**
 * The backdrop and the surface, once each.
 *
 * There were five dialog cards and they agreed on nothing. Border weight ran 2, 2, 2, 2, 1; the
 * card's horizontal padding ran 28, 28, 32, 24, 16 and its vertical padding 28, 28, 24, 16, 16;
 * the width cap ran 340, 340, 360 and two cards with no cap at all but a 260 floor; and the
 * scrim behind them ran 0.88, 0.88, 0.88, 0.92, 0.92, with the Atlas at 0.86 and the city
 * picker at 0.6. None of that variation meant anything — every one of those numbers was chosen
 * once, in a different week, by someone reading a different neighbouring file.
 *
 * `DialogScrim` is shared by every layer in the app. `DialogCard` is shared by the five that are
 * cards. Two layers deliberately keep a surface of their own and take only the scrim: the city
 * picker is a bottom sheet (flush to the edges, top-rounded, capped at 70% height) and the Atlas
 * is a 380-wide map panel. Those are different objects, not stragglers — forcing either into
 * `DialogCard` would mean a prop that exists for one caller, which is how this file's own list
 * of five got written in the first place.
 *
 * `DialogStrip` is a third surface for the same reason: a question or a failure is no longer a
 * floating card, it is parchment rising from the bottom edge with a coloured rule at its top and
 * no card border at all — genuinely a different object from `DialogCard`, not a variant of it.
 * `AlertModal` uses it under the new transparent `strip` scrim weight; `SheetModal` uses it too,
 * under its own `sheet` weight, because the shape moved but a sheet's dimming did not.
 */
/**
 * The scrim as a style rather than an element, for the two layers that need theirs to be
 * pressable so a tap outside dismisses — the Atlas and the city picker. Same three weights and
 * two alignments `DialogScrim` uses, because it is built from this.
 */
export function scrimStyle(weight: DialogWeight = 'dialog', align: 'center' | 'bottom' = 'center') {
  return [DIALOG_STYLES.scrim, SCRIM_STYLES[weight], ALIGN[align]];
}

export function DialogScrim({ weight = 'dialog', align = 'center', children, style }: {
  weight?: DialogWeight;

  /** Where the layer sits. A picker rises from the bottom edge; everything else centres. */
  align?: 'center' | 'bottom';
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View testID="dialog-scrim" style={[scrimStyle(weight, align), style]}>{children}</View>
  );
}

/** Built once rather than per render — four weights, two alignments, none of them dynamic. */
const SCRIM_STYLES: Record<DialogWeight, ViewStyle> = {
  sheet: { backgroundColor: overlay(SCRIM.sheet) },
  dialog: { backgroundColor: overlay(SCRIM.dialog) },
  ceremony: { backgroundColor: overlay(SCRIM.ceremony) },
  // A question or a failure, not a takeover: the room stays exactly as lit as it was.
  strip: { backgroundColor: 'transparent' },
};

const ALIGN: Record<'center' | 'bottom', ViewStyle> = {
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl },
  // No padding: a bottom sheet is flush to the screen's edges, which is what makes it a sheet.
  bottom: { justifyContent: 'flex-end' },
};

export function DialogCard({ weight = 'dialog', accent, children, style }: {
  /** `strip` has no card — see `DialogStrip` below, which is a different shape entirely. */
  weight?: Exclude<DialogWeight, 'strip'>;

  /** The edge colour, for a dialog whose tone changes it. Ignored by `sheet`, which is quiet. */
  accent?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const edge = weight === 'sheet' ? { borderColor: LINE.edge } : { borderColor: accent ?? ACCENT.base };
  return <View style={[DIALOG_STYLES.card, DIALOG_STYLES[weight], edge, style]}>{children}</View>;
}

/**
 * A question or a failure, as parchment rising from the bottom edge rather than a card floating
 * in the dark: full width, square-to-round top corners, a 2px rule in `accent` where a card would
 * have had a border on every side, and `ParchmentFill` — the same drawing `AppCard`'s hero panel
 * uses, so a re-tuned parchment cannot drift between the two surfaces it appears on.
 *
 * `wash` is the one thing a tone still needs beyond the rule: `STATUS_SOFT` colours are already a
 * translucent wash rather than a surface (see `theme.ts`), so laid over the parchment rather than
 * under it, it tints the strip without hiding the parchment it tints.
 *
 * Falls back to zero insets outside a `SafeAreaProvider` (there is one at the app root, always,
 * but not every test tree bothers to add one) rather than the throwing `useSafeAreaInsets`, so a
 * caller far from here — `SheetModal` reaches every report and picker screen — cannot fail a test
 * that was never about safe areas at all.
 *
 * Pinned to the bottom edge, a strip sits exactly where the keyboard rises — the phone number
 * field in `PhoneChangeModal` renders inside an `AlertModal` for that reason. `useAndroidKeyboardHeight`'s
 * own header explains why `KeyboardAvoidingView` cannot be trusted on Android under edge-to-edge,
 * and `app/chat/[matchId].tsx` already carries the split this follows: Android pads by the
 * measured keyboard height (the event stops at the navigation bar, so that bar is added back on
 * top of it, same as the chat composer), iOS wraps in `KeyboardAvoidingView behavior="padding"`,
 * and web does neither.
 */
export function DialogStrip({ accent, wash, children, style }: {
  /** The top rule's colour. A warning strip passes `STATUS.warning`; everything else, the brand. */
  accent?: string;

  /** A translucent tone over the parchment. Omit it for a strip with no tone of its own. */
  wash?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const insets = useContext(SafeAreaInsetsContext);
  const androidKeyboardHeight = useAndroidKeyboardHeight();
  const bottomInset = insets?.bottom ?? 0;
  const keyboardPad = androidKeyboardHeight > 0 ? androidKeyboardHeight + bottomInset : bottomInset;

  const strip = (
    <View
      testID="dialog-strip"
      style={[
        DIALOG_STYLES.strip,
        { borderTopColor: accent ?? ACCENT.base, paddingBottom: SPACE.xl + keyboardPad },
        style,
      ]}
    >
      <ParchmentFill />
      {!!wash && <View style={[StyleSheet.absoluteFillObject, { backgroundColor: wash }]} pointerEvents="none" />}
      {children}
    </View>
  );

  if (Platform.OS !== 'ios') return strip;
  return <KeyboardAvoidingView behavior="padding">{strip}</KeyboardAvoidingView>;
}

export const DIALOG_STYLES = StyleSheet.create({
  scrim: { flex: 1 },
  card: {
    backgroundColor: SURFACE.panel,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    gap: SPACE.sm,
  },
  sheet: {
    borderWidth: 1,
    padding: SPACE.lg,
    width: '100%',
    maxWidth: 360,
  },
  dialog: {
    borderWidth: 2,
    padding: SPACE.xxxl,
    width: '100%',
    maxWidth: 340,
  },
  // A ceremony's scrim spaces its stage from its card; both ceremonies wrote this out by hand.
  ceremonyScrim: { gap: SPACE.xxl },
  // A ceremony hugs its content — a chest's reward is three short lines — but is still capped
  // at the dialog's width so it cannot grow past every other layer in the app.
  ceremony: {
    borderWidth: 2,
    padding: SPACE.xxl,
    minWidth: 260,
    maxWidth: 340,
  },
  strip: {
    width: '100%',
    borderTopWidth: 2,
    borderTopLeftRadius: RADIUS.sm,
    borderTopRightRadius: RADIUS.sm,
    overflow: 'hidden',
    alignItems: 'center',
    gap: SPACE.sm,
    padding: SPACE.xl,
  },
});
