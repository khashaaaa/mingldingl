import { View, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { ACCENT, LINE, RADIUS, SCRIM, SPACE, SURFACE, overlay } from '../../lib/theme';

/**
 * How much of the app a layer is entitled to take over.
 *
 * `sheet` rises over a screen still meant to be read behind it; `dialog` asks a question, so
 * what is behind is context rather than content; `ceremony` is a tier-up or a chest, where
 * nothing behind it should compete.
 */
export type DialogWeight = 'sheet' | 'dialog' | 'ceremony';

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
    <View style={[scrimStyle(weight, align), style]}>{children}</View>
  );
}

/** Built once rather than per render — three weights, two alignments, none of them dynamic. */
const SCRIM_STYLES: Record<DialogWeight, ViewStyle> = {
  sheet: { backgroundColor: overlay(SCRIM.sheet) },
  dialog: { backgroundColor: overlay(SCRIM.dialog) },
  ceremony: { backgroundColor: overlay(SCRIM.ceremony) },
};

const ALIGN: Record<'center' | 'bottom', ViewStyle> = {
  center: { alignItems: 'center', justifyContent: 'center', padding: SPACE.xxl },
  // No padding: a bottom sheet is flush to the screen's edges, which is what makes it a sheet.
  bottom: { justifyContent: 'flex-end' },
};

export function DialogCard({ weight = 'dialog', accent, children, style }: {
  weight?: DialogWeight;

  /** The edge colour, for a dialog whose tone changes it. Ignored by `sheet`, which is quiet. */
  accent?: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const edge = weight === 'sheet' ? { borderColor: LINE.edge } : { borderColor: accent ?? ACCENT.base };
  return <View style={[DIALOG_STYLES.card, DIALOG_STYLES[weight], edge, style]}>{children}</View>;
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
});
