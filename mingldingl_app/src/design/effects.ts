import type { TextStyle } from 'react-native';
import { type Effect, effect } from './tokens';

/** #rrggbb + opacity → #rrggbbaa (React Native reads 8-digit hex). */
export function withAlpha(hex: string, opacity: number): string {
  const a = Math.round(Math.max(0, Math.min(1, opacity)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `${hex.slice(0, 7)}${a}`;
}

const css = (e: Effect) =>
  `${e.type === 'INNER_SHADOW' ? 'inset ' : ''}${e.x}px ${e.y}px ${e.radius}px 0px ${withAlpha(e.color, e.opacity)}`;

/** A Figma effect style as React Native's boxShadow (new architecture supports inset and multiple). */
export function boxShadow(name: keyof typeof effect): string {
  return (effect[name] as readonly Effect[]).map(css).join(', ');
}

/** Inset/Engraved Text: React Native text takes one shadow, so the deepest drop carries the carving. */
export const engraved: TextStyle = (() => {
  const drop = effect.insetEngravedText[2];
  return {
    textShadowColor: withAlpha(drop.color, drop.opacity),
    textShadowOffset: { width: drop.x, height: drop.y },
    textShadowRadius: drop.radius,
  };
})();
