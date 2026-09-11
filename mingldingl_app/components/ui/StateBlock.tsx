import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ReactNode } from 'react';
import type { LayoutChangeEvent, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { FogDrift } from '../vfx/FogDrift';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, LEADING, LINE, RADIUS, SPACE, STATUS, SURFACE, type Tone } from '../../lib/theme';
import { Icon } from './Icon';

/**
 * How loudly this block's mark is drawn, per `Tone` — the shared vocabulary in `theme.ts`, so a
 * warning here means the same word a dialog uses. The resolution is local because the jobs are
 * not the same: an empty state's icon should recede, a dialog's border should not.
 */
const TONE_COLORS: Record<Tone, string> = {
  neutral: INK.muted,
  good: ACCENT.base,
  warning: STATUS.warning,
  danger: STATUS.danger,
};

interface Props {
  tone?: Tone;
  icon?: React.ComponentProps<typeof Icon>['name'];
  title: string;
  body?: string;

  /** Buttons, laid out under the copy. */
  children?: ReactNode;

  /**
   * Drift fog behind the copy. A boolean rather than a node, because the two screens that wanted
   * it each kept their own size state, layout handler and `size.w > 0` ternary to build the same
   * element — the block already knows its own bounds, so it measures itself.
   */
  fog?: boolean;

  /**
   * Draw the block on its own panel rather than bare on the screen. Two screens had built this
   * card by hand, byte for byte identical, which is how the pair would have drifted apart the
   * first time one of them was touched.
   */
  framed?: boolean;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The screen has nothing to show, or could not load what it had.
 *
 * One shape for both, because they were already the same shape drawn many ways. The error
 * title alone appeared as display/xl on three screens, display/title on two, body/lg in primary
 * ink on three and body/lg in dim ink on one — and the empty-state title split three further
 * ways on top of that, with its body copy landing on `lg` about half the time and `md` the
 * rest. A reader cannot tell "the leaderboard failed" from "the chat failed" by looking, so the
 * two should not look different, and the way to guarantee that is to stop writing it out.
 *
 * A call site picks a `tone`, never a colour. An empty state's mark is `INK.muted` — already
 * the role tuned to be quiet but still perceptible at 4.49:1, so the `opacity: 0.6` two call
 * sites layered on top of it was pushing the mark back under the floor the role exists to
 * clear — a failure's is `STATUS.danger`, and a finished ceremony's is the accent.
 */
export function StateBlock({
  tone = 'neutral', icon, title, body, children, fog, framed, testID, style,
}: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const onLayout = fog
    ? (e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setSize((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }));
      }
    : undefined;

  return (
    <View style={[styles.wrap, framed && styles.framed, style]} onLayout={onLayout} testID={testID}>
      {fog && size.w > 0 ? <FogDrift width={size.w} height={size.h} /> : null}
      {icon ? <Icon name={icon} size={ICON_SIZES.hero} color={TONE_COLORS[tone]} /> : null}
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {children ? <View style={styles.actions}>{children}</View> : null}
    </View>
  );
}

/**
 * A list that is empty on purpose — a quiet line where rows would be. No icon, no title and no
 * call to action, which is what separates it from `StateBlock`: nothing has gone wrong and
 * there is nothing to do about it.
 */
export function EmptyHint({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.body, style]}>{children}</Text>;
}

/**
 * The one-line failure that appears beside the thing that failed — under a field, under a
 * button, inside a message bubble.
 *
 * These were written out by hand at two different sizes and every one of them in
 * `COLORS.emberLight` — the streak flame's colour, so a failed upload and a burning streak were
 * the same orange. They are `STATUS.danger` at one size now.
 */
export function FieldError({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.fieldError, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  fieldError: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.sm,
    lineHeight: LEADING.sm,
    color: STATUS.danger,
  },
  wrap: {
    // Exactly `flex: 1`, spelled out because `framed` has to switch off only the growing part:
    // a framed block hugs its copy, an unframed one fills the screen it is standing in for.
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACE.xxl,
    gap: SPACE.md,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: FONT_SIZES.title,
    lineHeight: LEADING.title,
    color: INK.primary,
    textAlign: 'center',
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: FONT_SIZES.md,
    lineHeight: LEADING.md,
    color: INK.dim,
    textAlign: 'center',
  },
  framed: {
    flexGrow: 0,
    flexBasis: 'auto',
    backgroundColor: SURFACE.panel,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: LINE.edge,
    padding: SPACE.giant,
    overflow: 'hidden',
  },
  actions: { alignSelf: 'stretch', gap: SPACE.sm, marginTop: SPACE.sm },

});
