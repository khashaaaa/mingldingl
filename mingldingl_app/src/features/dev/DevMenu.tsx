import { useQueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useState, useSyncExternalStore } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import Animated, { useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { PickRow } from '@/design/components/PickRow';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import {
  MOTION,
  type MotionName,
  setReduceMotionOverride,
  useReduceMotion,
  useReduceMotionOverride,
} from '@/design/motion';
import { color, dimension, duration } from '@/design/tokens';
import { getSnowOverride, setSnowOverride, subscribeSnow } from '@/design/world/rooms';
import { API_URL } from '@/lib/api/config';
import { devSendLive, devSetMyState, signOut } from '@/lib/api/generated/engine';
import { useBelongs } from '@/lib/belongs';
import { leaveTools } from '@/lib/devTools';
import { FEEDBACK, feedback, hearSound, WORLD_EVENTS, type WorldEvent } from '@/lib/feedback';
import { setLocale, useLocale } from '@/lib/i18n';
import { chooseLocale } from '@/lib/i18n/device';
import { LIVE_KINDS } from '@/lib/live/events';
import { signOutLocally } from '@/lib/session';
import { Scene } from '../common/Scene';
import { patchMe } from '../onboarding/Onboarding';

/** The engine's DevSeeder.SeedState, in order: the wire value is the index. */
export const SEED_STATES = [
  'Step 1 — name & age',
  'Step 2 — gender',
  'Step 3 — portraits',
  'Step 4 — tale & city',
  'Step 5 — oath',
  'Step 6 — welcome',
  'Finished',
  'Suspended',
  'Deleted',
] as const;

/** Each sound file once, with the world events that play it. */
const SOUNDS = Object.entries(
  WORLD_EVENTS.reduce<Record<string, WorldEvent[]>>((acc, e) => {
    const file = FEEDBACK[e].soundFile;
    if (file) acc[file] = [...(acc[file] ?? []), e];
    return acc;
  }, {}),
).map(([file, events]) => ({ file, events, play: events[0] as WorldEvent }));

const SOUND_GAP_MS = 1600;

/** A world event's own motion; the two room moves share Room Travel. */
const motionOf = (e: WorldEvent): MotionName => (e === 'roomDeeper' || e === 'roomHome' ? 'roomTravel' : e);

/**
 * Development only (reached from the Expo dev menu → "MingldIngl tools"). Puts this account into any
 * state, fires any live kind or world event, switches language, Reduce Motion and snow, signs out.
 * Developer-facing, so its labels are English and not in the string tables.
 */
export default function DevMenu() {
  const client = useQueryClient();
  // As the War Room does: the profile's language too, or what the engine writes stays in the old one.
  const speak = (l: 'en' | 'mn') => {
    chooseLocale(l);
    patchMe({ locale: l })
      .then(() => client.invalidateQueries())
      .catch(() => {}); // signed out: the device's choice is all there is
  };
  const locale = useLocale();
  const reduceOverride = useReduceMotionOverride();
  const reduced = useReduceMotion();
  const snow = useSyncExternalStore(subscribeSnow, getSnowOverride);
  const [note, setNote] = useState<string | null>(null);
  const pulse = useSharedValue(0);
  const { group } = useBelongs();
  const leave = () => leaveTools(group);

  // Android's back button leaves the same way as the header arrow.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => sub.remove();
  });

  const run = async (label: string, work: () => Promise<unknown>) => {
    setNote(`${label}…`);
    try {
      await work();
      setNote(`${label} ✓`);
    } catch (e) {
      setNote(`${label} failed: ${String(e)}`);
    }
  };

  const fire = (e: WorldEvent) => {
    feedback(e);
    const m = MOTION[motionOf(e)];
    // Reduced: M7's short fade instead of the full motion.
    const d = reduced ? duration.tap : m.duration;
    pulse.value = withSequence(withTiming(1, { duration: d / 2 }), withTiming(0, { duration: d / 2 }));
    setNote(`${e} · ${m.duration} ms${reduced ? ' (reduced)' : ''}`);
  };

  return (
    <Scene header={<RoomHeader title="Tools" onBack={leave} />}>
      <View style={styles.status}>
        <Txt variant="labelS" color="textMuted" selectable>
          {`${API_URL} · v${Constants.expoConfig?.version ?? '?'}`}
        </Txt>
        {note ? (
          <Txt variant="bodyS" color="textSecondary" accessibilityLiveRegion="polite">
            {note}
          </Txt>
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={[styles.pulse, { opacity: pulse, transform: [{ scale: pulse }] }]}
        />
      </View>

      <Section title="Put my account into">
        {SEED_STATES.map((name, state) => (
          <PickRow
            key={name}
            label={name}
            onPress={() =>
              run(name, async () => {
                await devSetMyState({ state });
                await client.invalidateQueries();
              })
            }
          />
        ))}
      </Section>

      <Section title="Fire a live event">
        {LIVE_KINDS.map((kind) => (
          <PickRow key={kind} label={kind} onPress={() => run(kind, () => devSendLive({ kind }))} />
        ))}
      </Section>

      <Section title="Fire a world event">
        {WORLD_EVENTS.map((e) => (
          <PickRow key={e} label={e} onPress={() => fire(e)} />
        ))}
      </Section>

      <Section title="Hear every sound">
        <PickRow
          label="Play all in turn"
          onPress={async () => {
            for (const [i, s] of SOUNDS.entries()) {
              if (i > 0) await new Promise((res) => setTimeout(res, SOUND_GAP_MS));
              hearSound(s.play);
              setNote(`${i + 1}/${SOUNDS.length} · ${s.file} · ${s.events.join(', ')}`);
            }
          }}
        />
        {SOUNDS.map((s) => (
          <PickRow
            key={s.file}
            label={`${s.file} — ${s.events.join(', ')}`}
            onPress={() => {
              hearSound(s.play);
              setNote(s.file);
            }}
          />
        ))}
      </Section>

      <Section title="Language">
        <PickRow label="English" selected={locale === 'en'} onPress={() => speak('en')} />
        <PickRow label="Монгол" selected={locale === 'mn'} onPress={() => speak('mn')} />
        <PickRow
          label="Pseudo-Mongolian"
          selected={locale === 'pseudo'}
          onPress={() => setLocale('pseudo')}
        />
      </Section>

      <Section title="Reduce Motion">
        <PickRow
          label="Follow the system"
          selected={reduceOverride === null}
          onPress={() => setReduceMotionOverride(null)}
        />
        <PickRow
          label="On"
          selected={reduceOverride === true}
          onPress={() => setReduceMotionOverride(true)}
        />
        <PickRow
          label="Off"
          selected={reduceOverride === false}
          onPress={() => setReduceMotionOverride(false)}
        />
      </Section>

      <Section title="Snow">
        <PickRow label="Follow the calendar" selected={snow === null} onPress={() => setSnowOverride(null)} />
        <PickRow label="Falling" selected={snow === true} onPress={() => setSnowOverride(true)} />
        <PickRow label="None" selected={snow === false} onPress={() => setSnowOverride(false)} />
      </Section>

      <Section title="More">
        <PickRow label="Component gallery" onPress={() => router.push('/dev/gallery')} />
        <PickRow
          label="Sign out"
          onPress={() =>
            run('Sign out', async () => {
              leave();
              await signOut().catch(() => {});
              await signOutLocally();
            })
          }
        />
      </Section>
    </Scene>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <PickRow kind="group" label={title} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  status: { gap: dimension.space2, minHeight: 48 },
  pulse: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: color.accentEmber,
  },
  // Rows run edge to edge, past the Scene's gutter.
  section: { marginHorizontal: -dimension.sizeGutter },
});
