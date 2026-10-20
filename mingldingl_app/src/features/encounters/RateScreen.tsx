import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Art, Glyph } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { Flicker } from '@/design/components/Flicker';
import { Glow } from '@/design/components/Glow';
import { InkLink } from '@/design/components/InkLink';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { useReduceMotion } from '@/design/motion';
import { color, dimension, easing } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import { getGetEncounterQueryKey, rateMeeting, useGetEncounter } from '@/lib/api/generated/engine';
import { feedback } from '@/lib/feedback';
import { t, tError, tVenue } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';

/** Rate the venue (Figma 33:1765): one to five stars from a kept meeting, or skip. */
export default function RateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const meeting = useGetEncounter(id).data?.meeting?.current;
  const [stars, setStars] = useState(0);
  const [busy, setBusy] = useState(false);
  const header = <RoomHeader title={t('room.encounter')} onBack={() => router.back()} />;
  if (!meeting) return <Scene header={header}>{null}</Scene>;

  const send = async (n: number) => {
    setBusy(true);
    try {
      client.setQueryData(getGetEncounterQueryKey(id), await rateMeeting(id, meeting.id, { stars: n }));
      if (n > 0) feedback('rewardBurst');
      router.back();
    } catch (e) {
      toast(
        'error',
        e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('error.generic'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Scene
      header={header}
      footer={
        <View style={styles.footer}>
          <Button
            label={t('rate.rate')}
            onPress={() => send(stars)}
            disabled={stars === 0}
            loading={busy}
            block
          />
          <InkLink label={t('rate.skip')} onPress={() => send(0)} disabled={busy} />
        </View>
      }
    >
      <View style={styles.page}>
        <View style={styles.lantern}>
          <View style={styles.light}>
            <Glow tint={color.accentGoldBright} strength={0.4} />
          </View>
          <Flicker>
            <Art name="lantern_lit" style={styles.lantern} fit="contain" />
          </Flicker>
        </View>
        <Txt variant="displayM" engraved align="center" accessibilityRole="header">
          {t('rate.title', { venue: tVenue(meeting.venue) })}
        </Txt>
        <View
          style={styles.stars}
          accessibilityRole="adjustable"
          accessibilityValue={{ min: 0, max: 5, now: stars }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={t('rate.stars', { n })}
              accessibilityState={{ selected: n <= stars }}
              onPress={() => {
                setStars(n);
                feedback('press');
              }}
              hitSlop={6}
            >
              <Star lit={n <= stars} order={n - 1} />
            </Pressable>
          ))}
        </View>
        <Txt variant="voiceM" color="textSecondary" align="center">
          {t('rate.body')}
        </Txt>
      </View>
    </Scene>
  );
}

/** A star that kindles with a little jump when it lights, in turn along the row. */
function Star({ lit, order }: { lit: boolean; order: number }) {
  const reduce = useReduceMotion();
  const pop = useSharedValue(1);
  useEffect(() => {
    if (!lit || reduce) return;
    pop.value = withDelay(
      order * 45,
      withSequence(withTiming(1.35, { duration: 90 }), withSpring(1, easing.anvil)),
    );
  }, [lit, reduce, order, pop]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <Animated.View style={a}>
      <Glyph name="star" size={32} tint={lit ? 'accentGoldBright' : 'textMuted'} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', gap: dimension.space4, paddingTop: dimension.space6 },
  lantern: { width: 150, height: 190 },
  light: { position: 'absolute', left: -50, right: -50, top: -30, bottom: -30 },
  stars: { flexDirection: 'row', gap: dimension.space3 },
  footer: { alignSelf: 'stretch', alignItems: 'center', gap: dimension.space3 },
});
