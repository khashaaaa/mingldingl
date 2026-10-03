import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { ACCENT } from '../../lib/theme';
import { Glyph, type GlyphName as InkName } from './Glyph';
type GlyphName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  name: GlyphName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * The icon-font names that stand for something in the world — an honour, a deed in the score
 * history, a venue, a room — and the ink drawing (`Glyph`) each one is shown as. Every screen
 * that names one of these gets the brush hand without its call site changing; the names left out
 * are controls (back, close, chevrons, camera, video, phone), which stay plain on purpose so a
 * button never reads as ornament. A new identity mark gets drawn in `Glyph` and listed here,
 * never left to the font.
 */
export const INKED: Partial<Record<GlyphName, InkName>> = {
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
};

export function Icon({ name, size = 20, color = ACCENT.base, style }: Props) {
  const ink = INKED[name];
  if (ink) return <Glyph name={ink} size={size} color={color} style={style as StyleProp<ViewStyle>} />;
  return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
}
