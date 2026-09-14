import { Tap } from '../ui/Tap';
import { Animated, Text, StyleSheet } from 'react-native';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, INK, SPACE } from '../../lib/theme';
import { Glyph, type GlyphName } from '../ui/Glyph';
import { TOAST_STYLES, useToastMotion } from './Toast';

interface Props {
  /** A hand-cut glyph, not an emoji: emoji render in each platform's own palette and voice. */
  icon: GlyphName;
  title: string;
  visible: boolean;
  onDismiss: () => void;
  onPress: () => void;
}

export function NudgeToast({ icon, title, visible, onDismiss, onPress }: Props) {
  const { translateY, opacity } = useToastMotion({ visible, offset: -120, holdMs: 2800, onDismiss });

  if (!visible) return null;

  return (
    <Animated.View style={[TOAST_STYLES.container, styles.container, { transform: [{ translateY }], opacity }]}>
      <Tap style={[TOAST_STYLES.card, styles.card]} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
        <Glyph name={icon} size={ICON_SIZES.xl} color={ACCENT.base} />
        <Text style={styles.title}>{title}</Text>
      </Tap>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { top: 60, zIndex: 1000 },
  card: { paddingHorizontal: SPACE.gutter, paddingVertical: SPACE.lg },
  title: { flex: 1, fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.lg, color: INK.primary },
});
