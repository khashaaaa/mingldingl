import { TouchableOpacity } from 'react-native';
import type { TouchableOpacityProps } from 'react-native';
import { PRESS } from '../../lib/theme';

interface Props extends Omit<TouchableOpacityProps, 'activeOpacity'> {
  /**
   * `none` for a control that animates its own press — a fade on top of a scale reads as two
   * things happening. Everything else takes the standard acknowledgement.
   */
  feedback?: 'opacity' | 'none';
}

/**
 * Anything you tap.
 *
 * The press treatment used to be a prop every call site wrote out. React Native's default
 * `activeOpacity` is 0.2 — the row does not acknowledge the touch so much as briefly leave — and
 * most touchables were taking it while the rest split three ways. Laddering the *value* only
 * moved the problem: it left a copy of `activeOpacity={PRESS.opacity}` at every call site, and a
 * test that could only ever police that exact spelling.
 *
 * Owning the treatment here means no screen writes it at all, and the rule becomes one a grep
 * cannot be reworded around: nothing outside this file reaches for `TouchableOpacity`.
 */
export function Tap({ feedback = 'opacity', ...rest }: Props) {
  return <TouchableOpacity activeOpacity={feedback === 'none' ? PRESS.none : PRESS.opacity} {...rest} />;
}
