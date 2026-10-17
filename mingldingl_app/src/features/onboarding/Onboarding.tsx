import { useQueryClient } from '@tanstack/react-query';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated, { Easing, SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StepLadder } from '@/design/components/StepLadder';
import { Txt } from '@/design/components/Txt';
import { MOTION } from '@/design/motion';
import { easing } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import { getGetMeQueryKey, getMe, updateMe, useGetAppStatus, useGetMe } from '@/lib/api/generated/engine';
import type { MeView, UpdateProfileRequest } from '@/lib/api/generated/model';
import { t, tError } from '@/lib/i18n';
import { Scene } from '../common/Scene';
import About from './steps/About';
import Gender from './steps/Gender';
import NameAge from './steps/NameAge';
import Oath from './steps/Oath';
import Photos from './steps/Photos';
import Welcome from './steps/Welcome';

export const TOTAL_STEPS = 6;
const STEPS = [NameAge, Gender, Photos, About, Oath, Welcome] as const;

type Onboarding = {
  me: MeView;
  /** The step on screen, 1–6. */
  step: number;
  /** The Room Header's height: it sits above the step's Scene, outside it. */
  headerHeight: number;
  photosMin: number;
  photosMax: number;
  /**
   * Runs a step's write and, once the engine answers, shows the next step the engine allows. Never
   * moves before the answer, and never past the server's step. Returns the error for the step to show.
   */
  advance: (write: () => Promise<MeView | undefined>) => Promise<ApiError | null>;
  /** What the person typed but has not sent, kept while they step back and forth. */
  drafts: Map<string, unknown>;
};

const Ctx = createContext<Onboarding | null>(null);

export function useOnboarding(): Onboarding {
  const o = useContext(Ctx);
  if (!o) throw new Error('useOnboarding outside Onboarding');
  return o;
}

export const asApiError = (e: unknown) =>
  e instanceof ApiError ? e : new ApiError('network', 0, 'network', String(e));

const NOTHING: UpdateProfileRequest = {
  name: null,
  gender: null,
  bio: null,
  city: null,
  oath: null,
  locale: null,
  welcomed: null,
};

/**
 * A step's field that outlives the step: each step remounts on travel, so a plain useState lost a
 * tale typed on step 4 when the person stepped back to their portraits and returned.
 */
export function useDraft<T>(key: string, initial: T): [T, (v: T) => void] {
  const { drafts } = useOnboarding();
  const [value, setValue] = useState<T>(() => (drafts.has(key) ? (drafts.get(key) as T) : initial));
  const set = useCallback(
    (v: T) => {
      drafts.set(key, v);
      setValue(v);
    },
    [drafts, key],
  );
  return [value, set];
}

/** `PUT /me` with only the named fields; the rest stay as they are. */
export const patchMe = (fields: Partial<UpdateProfileRequest>) => updateMe({ ...NOTHING, ...fields });

/** What a step shows under its field when a write fails: the engine's rule, or the network line. */
export const errorText = (e: ApiError) =>
  e.kind === 'rule'
    ? tError(e.code, e.message)
    : e.kind === 'network'
      ? t('error.network')
      : t('error.generic');

/**
 * The six steps. The step on screen is the one the person is viewing, capped by the server's
 * `onboardingStep`: a relaunch opens on the server's step, going back shows an earlier one, and
 * forward only follows a write the engine accepted — so a portrait finishing in the background does
 * not pull the person off the portraits step.
 */
export default function Onboarding() {
  const client = useQueryClient();
  const me = useGetMe().data;
  const app = useGetAppStatus().data;
  const server = Math.max(1, me?.onboardingStep ?? 1);
  const [viewing, setViewing] = useState(server);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [headerHeight, setHeaderHeight] = useState(0);
  const drafts = useRef(new Map<string, unknown>()).current;
  const step = Math.min(viewing, server, TOTAL_STEPS);

  const advance = useCallback<Onboarding['advance']>(
    async (write) => {
      try {
        const next = (await write()) ?? (await getMe());
        client.setQueryData(getGetMeQueryKey(), next);
        setDirection(1);
        setViewing(Math.min(step + 1, next.onboardingStep));
        return null;
      } catch (e) {
        return asApiError(e);
      }
    },
    [client, step],
  );

  const back = useCallback(() => {
    setDirection(-1);
    setViewing(step - 1);
  }, [step]);

  // Android's back button steps back like the header's arrow; on step 1 it leaves the app as usual.
  useEffect(() => {
    if (step <= 1) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [step, back]);

  if (!me) return null;
  const Step = STEPS[step - 1] ?? NameAge;
  const m = MOTION.roomTravel;
  const enter = (direction === 1 ? SlideInRight : SlideInLeft)
    .duration(m.duration)
    .easing(Easing.bezier(...easing.forgeOut));

  return (
    <Ctx.Provider
      value={{
        me,
        step,
        headerHeight,
        advance,
        drafts,
        photosMin: app?.photosMin ?? 3,
        photosMax: app?.photosMax ?? 6,
      }}
    >
      <View style={styles.screen}>
        <View onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
          <RoomHeader
            title={t(step === TOTAL_STEPS ? 'room.hearth' : 'room.gate')}
            onBack={step > 1 ? back : undefined}
          />
        </View>
        <Animated.View key={step} entering={enter} style={styles.screen}>
          <Step />
        </Animated.View>
      </View>
    </Ctx.Provider>
  );
}

/** One step's page: ladder, title, hint, its fields, and the action pinned at the foot. */
export function StepScene({
  title,
  hint,
  footer,
  children,
  centered,
}: {
  title?: string;
  hint?: string;
  footer: ReactNode;
  children?: ReactNode;
  centered?: boolean;
}) {
  const { step, headerHeight } = useOnboarding();
  return (
    // The Room Header stays put above the travelling step, so the Scene draws none.
    <Scene header={false} footer={footer} keyboardOffset={headerHeight}>
      <View style={centered && styles.centered}>
        <StepLadder step={step} total={TOTAL_STEPS} />
      </View>
      {title ? (
        <Txt variant="displayL" engraved accessibilityRole="header">
          {title}
        </Txt>
      ) : null}
      {hint ? (
        <Txt variant="voiceM" color="textSecondary">
          {hint}
        </Txt>
      ) : null}
      {children}
    </Scene>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  centered: { alignItems: 'center' },
});
