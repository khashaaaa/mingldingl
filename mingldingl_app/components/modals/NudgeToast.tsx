import { useEffect, useRef } from 'react';
import { Tap } from '../ui/Tap';
import { Animated, Text, StyleSheet } from 'react-native';
import { ACCENT, FONTS, FONT_SIZES, INK, RADIUS, SPACE, SURFACE } from '../../lib/theme';
interface Props {
  icon: string;
  title: string;
  visible: boolean;
  onDismiss: () => void;
  onPress: () => void;
}

export function NudgeToast({ icon, title, visible, onDismiss, onPress }: Props) {
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  // Every caller passes an inline arrow; reading it through a ref keeps the auto-dismiss timer
  // keyed on `visible` alone instead of restarting on the parent's every render.
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 12, stiffness: 180 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: -120, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => onDismissRef.current());
      }, 2800);
      return () => clearTimeout(t);
    }
  }, [visible, translateY, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <Tap style={styles.card} onPress={onPress}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
      </Tap>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 60, left: 20, right: 20, zIndex: 1000 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    backgroundColor: SURFACE.panel,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: ACCENT.base,
    paddingHorizontal: SPACE.gutter,
    paddingVertical: SPACE.lg,
    shadowColor: ACCENT.base,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  icon: { fontSize: FONT_SIZES.title },
  title: { flex: 1, fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.lg, color: INK.primary },
});
