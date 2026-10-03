import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { ACCENT } from '../../lib/theme';
import { Glyph, type GlyphName as InkName } from './Glyph';
interface Props {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Every name a call site may pass, and the ink drawing (`Glyph`) it is shown as. The names are the
 * stock icon-font names the screens were written with; the font itself is gone (2026-10-03), so
 * this table is closed — a name not listed here is a compile error, never a fallback to a
 * Material icon. A new mark gets drawn in `Glyph` and listed here.
 */
export const INKED = {
  // The honours.
  'hand-heart': 'oath',
  fire: 'flame',
  seal: 'seal',
  'seal-variant': 'seal',
  'check-decagram': 'seal',
  'vector-line': 'thread-1',
  'vector-polyline': 'thread-2',
  'vector-triangle': 'thread-3',
  bugle: 'horn',
  handshake: 'clasp',
  'weather-sunset-up': 'dawn',
  bandage: 'mended',
  'map-legend': 'map',
  'home-heart': 'hearth',
  'bow-arrow': 'bow',
  'moon-full': 'moon',
  // Deeds in the score history, and the chests.
  'weather-sunny': 'dawn',
  'account-edit': 'quill',
  'message-text': 'letters',
  'message-text-outline': 'letters',
  'keyboard-return': 'letters',
  snowflake: 'ice',
  'script-text': 'scroll',
  'map-marker': 'waypoint',
  'map-marker-star': 'waypoint',
  'map-marker-check': 'waypoint',
  'map-marker-path': 'map',
  ghost: 'frost',
  alert: 'ember',
  target: 'target',
  'treasure-chest': 'chest-open',
  'treasure-chest-outline': 'pledge',
  gift: 'chest-open',
  medal: 'chest-open',
  recycle: 'chest-open',
  'scale-balance': 'scales',
  'account-cancel': 'chair',
  trophy: 'crown',
  'sword-cross': 'swords',
  'star-four-points': 'spark',
  anvil: 'forge',
  // Venues.
  coffee: 'cup',
  'silverware-fork-knife': 'feast',
  'glass-cocktail': 'goblet',
  'movie-open': 'mask',
  hiking: 'mountain',
  bank: 'temple',
  // The rooms a link opens.
  'book-heart': 'book',
  'book-open-variant': 'book',
  'pencil-outline': 'quill',
  pencil: 'quill',
  'share-variant': 'horn',
  'cog-outline': 'swords',
  'crown-outline': 'crown',
  'podium-gold': 'crown',
  'file-document-outline': 'scroll',
  'shield-lock-outline': 'shield',
  'shield-account': 'shield',
  'shield-alert-outline': 'shield',
  // The kit keeps no monsters: a skull is an ember (a warning) or an empty chair (nobody came).
  'skull-crossbones': 'ember',
  'skull-outline': 'chair',
  // The rest of the world's marks, mapped onto drawings that already stand for them.
  map: 'map',
  'compass-rose': 'map',
  'crosshairs-gps': 'target',
  'party-popper': 'spark',
  brain: 'scroll',
  'calendar-check': 'page',
  candle: 'candle',
  chat: 'letters',
  // The video call is the Flame Rite.
  video: 'flame',
  lock: 'gate',
  'rhombus-outline': 'knot',
  'alert-circle': 'ember',
  'alert-octagon': 'ember',
  'heart-broken': 'thread-cut',
  'link-variant-off': 'thread-cut',
  account: 'person',
  'account-remove': 'chair',
  'account-off-outline': 'chair',
  'phone-outline': 'horn',
  // Controls.
  close: 'close',
  'phone-hangup': 'close',
  'arrow-left': 'back',
  'chevron-right': 'chevron',
  'chevron-double-up': 'rise',
  'check-bold': 'check',
  'check-circle': 'check-ring',
  'checkbox-marked-circle': 'check-ring',
  'circle-outline': 'ring',
  'checkbox-blank-circle-outline': 'ring',
  'dots-vertical': 'more',
  refresh: 'turn',
  star: 'star',
  'star-outline': 'star-blank',
  flag: 'pennant',
  camera: 'eye',
  'camera-plus': 'eye',
  'video-off': 'eye-shut',
  microphone: 'horn',
  'microphone-off': 'horn-hushed',
  'image-plus': 'frame',
  'image-multiple': 'frame',
} as const satisfies Record<string, InkName>;

export type IconName = keyof typeof INKED;

export function Icon({ name, size = 20, color = ACCENT.base, style }: Props) {
  return <Glyph name={INKED[name]} size={size} color={color} style={style as StyleProp<ViewStyle>} />;
}
