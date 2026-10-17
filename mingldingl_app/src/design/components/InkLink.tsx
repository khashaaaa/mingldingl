import { Pressable, View } from 'react-native';
import { withAlpha } from '../effects';
import { color } from '../tokens';
import { Art } from './Art';
import { Txt } from './Txt';

const DISABLED = 0.4;

/**
 * A quiet action in the app's own voice, with a gold brush stroke under it. Disabled dims the ink
 * itself (no view-level opacity layer). One line by design: Android's sub-pixel rounding can
 * otherwise push the last word of a measured-to-fit label onto a line that is never shown.
 */
export function InkLink({
  label,
  onPress,
  disabled,
  align = 'center',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  /** Centred under a block by default; `start` sits it at the left edge of a form (City Picker). */
  align?: 'center' | 'start';
}) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={{
        paddingVertical: 14,
        paddingHorizontal: 4,
        alignSelf: align === 'start' ? 'flex-start' : 'center',
      }}
    >
      {({ pressed }) => (
        <View style={{ paddingBottom: 11 }}>
          <Txt
            numberOfLines={1}
            variant="voiceM"
            color={pressed ? 'accentGold' : 'accentGoldBright'}
            style={[{ paddingRight: 3 }, disabled && { color: withAlpha(color.accentGoldBright, DISABLED) }]}
          >
            {label}
          </Txt>
          <Art
            name="brush_underline"
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: '100%',
              height: 7,
              opacity: disabled ? DISABLED : 1,
            }}
          />
        </View>
      )}
    </Pressable>
  );
}
