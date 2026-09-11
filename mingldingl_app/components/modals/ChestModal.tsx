import { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, StyleSheet } from 'react-native';
import { GameButton } from '../ui/GameButton';
import { ChestBurst } from '../vfx/ChestBurst';
import { Icon } from '../ui/Icon';
import { i18n } from '../../lib/i18n';
import { ACCENT, FONTS, FONT_SIZES, ICON_SIZES, SPACE } from '../../lib/theme';
import { DIALOG_STYLES, DialogCard, DialogScrim } from './DialogSurface';
import { AppModal } from './AppModal';

interface Props { visible: boolean; xp: number; onDismiss: () => void; }

/** The bounty chest and milestone feats pay score only; honours are earned by named deeds elsewhere. */
export function ChestModal({ visible, xp, onDismiss }: Props) {
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
  }, [visible, shake, pop]);

  return (
    <AppModal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <DialogScrim weight="ceremony" style={DIALOG_STYLES.ceremonyScrim}>
        <Animated.View
          style={{
            transform: [
              { translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) },
              { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) },
            ],
          }}
        >
          <Icon name={revealed ? 'treasure-chest' : 'treasure-chest-outline'} size={ICON_SIZES.splash} color={ACCENT.base} />
        </Animated.View>
        <View style={{ width: 220, height: 220, position: 'absolute' }} pointerEvents="none">
          <ChestBurst size={220} trigger={burst} />
        </View>
        {revealed && (
          <DialogCard weight="ceremony">
            <Text style={styles.xp}>+{xp} {i18n.t('pts')}</Text>
            <GameButton variant="primary" style={styles.closeBtn} onPress={onDismiss}>{i18n.t('take_bounty')}</GameButton>
          </DialogCard>
        )}
      </DialogScrim>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  xp: { fontFamily: FONTS.display, fontSize: FONT_SIZES.display, color: ACCENT.base },
  closeBtn: { marginTop: SPACE.md, alignSelf: 'stretch' },
});
