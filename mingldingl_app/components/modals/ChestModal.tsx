import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, View, Text, StyleSheet } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { ChestBurst } from '../vfx/ChestBurst';
import { Icon } from '../ui/Icon';
import { RARITY_COLORS } from '../../lib/tiers';
import { i18n } from '../../lib/i18n';
import { COLORS, FONTS, RADIUS } from '../../lib/theme';

export interface ChestItem { nameKey: string; rarity: string; itemType: string; }
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
          <Icon name={revealed ? 'treasure-chest' : 'treasure-chest-outline'} size={72} color={COLORS.gold} />
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
  overlay: { flex: 1, backgroundColor: 'rgba(10,11,16,0.92)', alignItems: 'center', justifyContent: 'center', gap: 24 },
  rewardCard: {
    backgroundColor: COLORS.panel, borderWidth: 2, borderRadius: RADIUS.md,
    paddingHorizontal: 32, paddingVertical: 24, alignItems: 'center', gap: 8, minWidth: 260,
  },
  xp: { fontFamily: FONTS.displayBlack, fontSize: 28, color: COLORS.gold },
  rarity: { fontFamily: FONTS.display, fontSize: 11, letterSpacing: 2 },
  itemName: { fontFamily: FONTS.bodyBold, fontSize: 17, color: COLORS.text, textAlign: 'center' },
  closeBtn: { marginTop: 12, alignSelf: 'stretch' },
});
