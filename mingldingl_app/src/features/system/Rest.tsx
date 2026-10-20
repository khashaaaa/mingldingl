import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, BackHandler, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { InkLink } from '@/design/components/InkLink';
import { Txt } from '@/design/components/Txt';
import { color } from '@/design/tokens';
import { useGetAppStatus } from '@/lib/api/generated/engine';
import { t } from '@/lib/i18n';
import { Scene } from '../common/Scene';

/** The floor dims over this last stretch before the fire burns low. */
const DIM_MS = 60_000;
/** Away this long and the sitting starts again. */
const AWAY_RESETS_MS = 5 * 60_000;
const DIM_TO = 0.55;
/** Never over a call or a ceremony: wait for it to end and look again a minute later. */
const BUSY = /^\/(call|rite|ceremony|rest)\b/;

let restartSitting: () => void = () => {};

/**
 * Counts continuous time in the world on this device (app status `restMinutes`; 0 = never). The
 * last minute dims the floor, then "The fire burns low" (Figma 45:639) — never a lockout.
 */
export function RestWatch() {
  const minutes = useGetAppStatus().data?.restMinutes ?? 0;
  const dim = useSharedValue(0);
  const sitting = useRef({ since: Date.now(), awayAt: null as number | null });
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const path = usePathname();
  const pathRef = useRef(path);
  pathRef.current = path;

  useEffect(() => {
    const clear = () => {
      for (const id of timers.current) clearTimeout(id);
      timers.current = [];
    };
    const schedule = () => {
      clear();
      cancelAnimation(dim);
      dim.value = 0;
      if (minutes <= 0) return;
      const left = minutes * 60_000 - (Date.now() - sitting.current.since);
      timers.current.push(
        setTimeout(
          () => {
            if (BUSY.test(pathRef.current)) return;
            dim.value = withTiming(DIM_TO, { duration: DIM_MS, easing: Easing.inOut(Easing.quad) });
          },
          Math.max(0, left - DIM_MS),
        ),
        setTimeout(
          () => {
            if (BUSY.test(pathRef.current)) {
              sitting.current.since += DIM_MS; // look again in a minute
              schedule();
              return;
            }
            cancelAnimation(dim);
            dim.value = withTiming(0, { duration: 600 });
            router.push('/rest');
          },
          Math.max(0, left),
        ),
      );
    };
    restartSitting = () => {
      sitting.current.since = Date.now();
      schedule();
    };
    const sub = AppState.addEventListener('change', (s) => {
      const now = Date.now();
      if (s === 'active') {
        const { awayAt } = sitting.current;
        if (awayAt !== null && now - awayAt >= AWAY_RESETS_MS) sitting.current.since = now;
        else if (awayAt !== null) sitting.current.since += now - awayAt; // time away is not time sat
        sitting.current.awayAt = null;
        schedule();
      } else if (sitting.current.awayAt === null) {
        sitting.current.awayAt = now;
        clear();
      }
    });
    schedule();
    return () => {
      clear();
      sub.remove();
    };
  }, [minutes, dim]);

  const veil = useAnimatedStyle(() => ({ opacity: dim.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.veil, veil]} />;
}

/** The fire burns low: rest now (leaves the app where the platform allows), or a little longer. */
export default function Rest() {
  const longer = () => {
    restartSitting();
    router.back();
  };
  return (
    <View style={styles.room}>
      <Scene
        footer={
          <>
            <Button
              block
              kind="plain"
              label={t('rest.now')}
              onPress={() => {
                restartSitting();
                router.back();
                if (Platform.OS === 'android') BackHandler.exitApp();
              }}
            />
            <InkLink label={t('rest.longer')} onPress={longer} />
          </>
        }
      >
        <View style={styles.body}>
          <Art name="state_error" style={styles.fire} fit="contain" />
          <Txt variant="displayL" engraved align="center" accessibilityRole="header">
            {t('rest.title')}
          </Txt>
          <Txt variant="voiceL" color="textSecondary" align="center">
            {t('rest.body')}
          </Txt>
        </View>
      </Scene>
    </View>
  );
}

const styles = StyleSheet.create({
  veil: { backgroundColor: color.bgSunken },
  room: { flex: 1, backgroundColor: color.bgSunken },
  body: { alignItems: 'center', gap: 16, paddingTop: 200 },
  fire: { width: 120, height: 120 },
});
