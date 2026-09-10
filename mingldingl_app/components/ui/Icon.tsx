import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { StyleProp, TextStyle } from 'react-native';
import { ACCENT } from '../../lib/theme';
type GlyphName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

interface Props {
  name: GlyphName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function Icon({ name, size = 20, color = ACCENT.base, style }: Props) {
  return <MaterialCommunityIcons name={name} size={size} color={color} style={style} />;
}
