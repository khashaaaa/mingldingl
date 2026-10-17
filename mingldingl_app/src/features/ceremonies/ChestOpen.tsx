import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { Reveal } from '@/design/components/Reveal';
import { Txt } from '@/design/components/Txt';
import { MOTION, useReduceMotion } from '@/design/motion';
import { easing } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import { openChest, useGetChests } from '@/lib/api/generated/engine';
import { feedback } from '@/lib/feedback';
import { t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { Veil } from './Veil';

/**
 * A bounty chest (Figma 36:266). What it holds is shown before it opens — no gamble. Opening bursts
 * the lid on the anvil, the light flares and the bounty rises to the satchel (1.6 s), then it leaves.
 */
export default function ChestOpen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const chest = useGetChests().data?.find((c) => c.id === id);
  const reduce = useReduceMotion();
  const [opening, setOpening] = useState(false);
  const burst = useSharedValue(1);
  const rise = useSharedValue(0);
  const lid = useAnimatedStyle(() => ({ transform: [{ scale: burst.value }] }));
  const bounty = useAnimatedStyle(() => ({
    opacity: 1 - rise.value,
    transform: [{ translateY: -120 * rise.value }, { scale: 1 - 0.4 * rise.value }],
  }));
  const open = async () => {
    if (!chest || opening) return;
    setOpening(true);
    try {
      await openChest(chest.id);
      feedback('chestOpen');
      const d = MOTION.chestOpen.duration;
      if (!reduce) {
        burst.value = withSequence(withTiming(1.12, { duration: 120 }), withSpring(1, easing.anvil));
        rise.value = withTiming(1, { duration: d });
      }
      setTimeout(() => router.back(), reduce ? 300 : d);
    } catch (e) {
      setOpening(false);
      toast('error', e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'));
    }
  };
  return (
    <Veil>
      <Scene footer={<Button label={t('chest.open')} onPress={open} disabled={!chest || opening} block />}>
        <View style={styles.column}>
          <Animated.View style={lid}>
            <Art name="chest_open" style={styles.chest} fit="contain" />
          </Animated.View>
          <Reveal>
            <Txt variant="displayL" engraved align="center" accessibilityRole="header">
              {t('chest.title')}
            </Txt>
          </Reveal>
          {chest ? (
            <Animated.View style={bounty}>
              <Txt variant="numberL" color="textAccent" align="center">
                {t('chest.points', { points: chest.points })}
              </Txt>
            </Animated.View>
          ) : null}
        </View>
      </Scene>
    </Veil>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: 16, paddingTop: 168 },
  chest: { width: 200, height: 170 },
});
