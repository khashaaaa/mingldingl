import { useEffect, useRef } from 'react';
import { Animated, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, FONTS, FONT_SIZES, RADIUS, SPACE } from '../../lib/theme';

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
        ]).start(onDismiss);
      }, 2800);
      return () => clearTimeout(t);
    }
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY }], opacity }]}>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.85}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 60, left: 20, right: 20, zIndex: 1000 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACE.lg,
    backgroundColor: COLORS.panel,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.gold,
    paddingHorizontal: SPACE.gutter,
    paddingVertical: SPACE.lg,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  icon: { fontSize: FONT_SIZES.title },
  title: { flex: 1, fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.lg, color: COLORS.text },
});
