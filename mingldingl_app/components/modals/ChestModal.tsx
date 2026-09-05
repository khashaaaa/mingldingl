import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, View, Text, StyleSheet } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { ChestBurst } from '../vfx/ChestBurst';
import { Icon } from '../ui/Icon';
import { RARITY_COLORS } from '../../lib/tiers';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, FONT_SIZES, ICON_SIZES, RADIUS, SPACE, overlay } from '../../lib/theme';

export interface ChestItem { nameKey: string; rarity: string; itemType: string; }

/**
 * The engine types every loot field as optional, so a chest item has to be narrowed before its
 * `nameKey` can be handed to `i18n.t` — casting the response instead would let a null key through
 * and render i18n-js's `[missing "en." translation]` marker. Same boundary as `toDroppedItem`.
 */
export function toChestItem(
  item?: { nameKey?: string | null; rarity?: string | null; itemType?: string | null } | null,
): ChestItem | null {
  if (!item?.nameKey || !item?.rarity || !item?.itemType) return null;
  return { nameKey: item.nameKey, rarity: item.rarity, itemType: item.itemType };
}

interface Props { visible: boolean; xp: number; item?: ChestItem | null; onDismiss: () => void; }

export function ChestModal({ visible, xp, item, onDismiss }: Props) {
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const anim = useRef<Animated.CompositeAnimation | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    if (!visible) {
      anim.current?.stop();
      anim.current = null;
      setRevealed(false); shake.setValue(0); pop.setValue(0);
      return;
    }
    anim.current = Animated.sequence([
      Animated.loop(
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        ]),
        { iterations: 6 },
      ),
      Animated.timing(shake, { toValue: 0, duration: 40, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 200 }),
    ]);

    anim.current.start(({ finished }) => { if (finished) { setRevealed(true); setBurst((b) => b + 1); } });
    return () => { anim.current?.stop(); anim.current = null; };
  }, [visible]);

  const rarityColor = item ? (RARITY_COLORS[item.rarity] ?? COLORS.bronze) : COLORS.gold;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <Animated.View
          style={{
            transform: [
              { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) },
              { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) },
            ],
          }}
        >
          <Icon name={revealed ? 'treasure-chest' : 'treasure-chest-outline'} size={ICON_SIZES.splash} color={COLORS.gold} />
        </Animated.View>
        <View style={{ width: 220, height: 220, position: 'absolute' }} pointerEvents="none">
          <ChestBurst size={220} trigger={burst} />
        </View>
        {revealed && (
          <View style={[styles.rewardCard, { borderColor: rarityColor }]}>
            <Text style={styles.xp}>+{xp} {i18n.t('pts')}</Text>
            {item && (
              <>
                <Text style={[styles.rarity, { color: rarityColor }]}>
                  {i18n.t(`rarity_${item.rarity.toLowerCase()}`).toUpperCase()} · {i18n.t(`type_${item.itemType.toLowerCase()}`)}
                </Text>
                <Text style={styles.itemName}>{i18n.t(item.nameKey)}</Text>
              </>
            )}
            <GameButton variant="primary" style={styles.closeBtn} onPress={onDismiss}>{i18n.t('take_bounty')}</GameButton>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: overlay(0.92), alignItems: 'center', justifyContent: 'center', gap: SPACE.xxl },
  rewardCard: {
    backgroundColor: COLORS.panel, borderWidth: 2, borderRadius: RADIUS.md,
    paddingHorizontal: SPACE.huge, paddingVertical: SPACE.xxl, alignItems: 'center', gap: SPACE.sm, minWidth: 260,
  },
  xp: { fontFamily: FONTS.displayBlack, fontSize: FONT_SIZES.display, color: COLORS.gold },
  rarity: { fontFamily: FONTS.utility, fontSize: FONT_SIZES.sm, letterSpacing: 1 },
  itemName: { fontFamily: FONTS.bodyBold, fontSize: FONT_SIZES.xl, color: COLORS.text, textAlign: 'center' },
  closeBtn: { marginTop: SPACE.md, alignSelf: 'stretch' },
});
