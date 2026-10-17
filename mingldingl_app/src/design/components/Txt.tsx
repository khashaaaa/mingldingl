import { Text, type TextProps } from 'react-native';
import { useLocale } from '@/lib/i18n';
import { engraved as engravedStyle } from '../effects';
import { color, type TypeName, type, typeMn } from '../tokens';

export type ColorName = keyof typeof color;

export type TxtProps = TextProps & {
  variant: TypeName;
  color?: ColorName;
  engraved?: boolean;
  align?: 'left' | 'center' | 'right';
};

/**
 * Centred text spans its parent and centres inside it. Shrink-wrapped to its own width, Android
 * draws a line that fits to within a pixel ("A first portrait": 638.4 px in a 639 px box) one
 * word short — the last word wraps out of a one-line box.
 */
const fill = { alignSelf: 'stretch' } as const;

/** Text in a Figma text style. Mongolian swaps the faces that have no Cyrillic (room titles). */
export function Txt({ variant, color: c = 'textPrimary', engraved, align, style, ...rest }: TxtProps) {
  const locale = useLocale();
  const t = locale === 'en' ? type[variant] : typeMn[variant];
  return (
    <Text
      {...rest}
      style={[
        t,
        { color: color[c] },
        align && { textAlign: align },
        align === 'center' && fill,
        engraved && engravedStyle,
        style,
      ]}
      maxFontSizeMultiplier={1.4}
    />
  );
}
