import { useEffect, useRef } from 'react';
import { Animated, View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';
import { RARITY_COLORS } from '../../lib/tiers';
import { Icon } from '../ui/Icon';

interface Props {
  title: string;
  points: number;
  visible: boolean;
  onDismiss: () => void;
  item?: { nameKey: string; rarity: string } | null;

  bottomOffset?: number;
}

const RAY_ANGLES = [0, 30, 60, 90, 120, 150];

export function LootToast({ title, points, visible, onDismiss, item, bottomOffset = 0 }: Props) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(140)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const rays = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 12, stiffness: 180 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 220 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(rays, { toValue: 0.5, duration: 500, useNativeDriver: true }),
      ]).start();
      const t = setTimeout(() => {
        Animated.parallel([
          Animated.timing(translateY, { toValue: 140, duration: 300, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(rays, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]).start(() => { scale.setValue(0.8); onDismiss(); });
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [visible]);

  function dismissNow() {
    Animated.parallel([
      Animated.timing(translateY, { toValue: 140, duration: 300, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(rays, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => { scale.setValue(0.8); onDismiss(); });
  }

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { bottom: insets.bottom + 20 + bottomOffset, transform: [{ translateY }, { scale }], opacity },
      ]}
    >
      <TouchableOpacity style={styles.card} activeOpacity={0.85} onPress={dismissNow} accessibilityLabel={i18n.t('alert_dismiss')}>
        <View style={styles.iconWrap}>
          {RAY_ANGLES.map((deg) => (
            <Animated.View
              key={deg}
              style={[styles.ray, { opacity: rays, transform: [{ rotate: `${deg}deg` }] }]}
            />
          ))}
          <Icon name="trophy" size={22} color={COLORS.gold} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{title}</Text>
          {points > 0 && <Text style={styles.points}>{i18n.t('xp_earned', { points })}</Text>}
          {item && (
            <Text style={[styles.itemLine, { color: RARITY_COLORS[item.rarity] ?? COLORS.gold }]}>
              ✦ {i18n.t(item.nameKey)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 20, right: 20, zIndex: 999 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.panel,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    borderColor: COLORS.gold,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconWrap: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', width: 36, height: 2, backgroundColor: COLORS.goldBright },
  textCol: { flex: 1, gap: 2 },
  title: { fontFamily: FONTS.bodyBold, fontSize: 14, color: COLORS.text },
  points: { fontFamily: FONTS.display, fontSize: 11, color: COLORS.gold, letterSpacing: 0.5 },
  itemLine: { fontFamily: FONTS.bodyMedium, fontSize: 12 },
});
