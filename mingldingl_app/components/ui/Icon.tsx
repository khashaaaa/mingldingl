import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { StyleProp, TextStyle } from 'react-native';
import { COLORS } from '../../lib/theme';

type GlyphName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  name: GlyphName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

// Single import point for the app's decorative glyphs — a plain sized/tinted
// font character, no gradients or shadow layers, so ornamentation never adds
// paint cost the way a new texture or illustration would.
export function Icon({ name, size = 20, color = COLORS.gold, style }: Props) {
  return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
}
