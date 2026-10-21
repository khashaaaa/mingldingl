import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RtcSurfaceView } from 'react-native-agora';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Art, FillArt } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { ChoiceCard } from '@/design/components/ChoiceCard';
import { InkLink } from '@/design/components/InkLink';
import { Reveal } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StateBlock } from '@/design/components/StateBlock';
import { Swing } from '@/design/components/Swing';
import { Txt } from '@/design/components/Txt';
import { color, dimension } from '@/design/tokens';
import { setFireOverride, setSkyOverride } from '@/design/world/rooms';
import { ApiError } from '@/lib/api/client';
import {
  decideSquare,
  getGetNightQueryKey,
  joinSquare,
  leaveSquare,
  useGetNight,
} from '@/lib/api/generated/engine';
import type { NightView } from '@/lib/api/generated/model';
import { feedback } from '@/lib/feedback';
import { type StringKey, t, tCount, tError } from '@/lib/i18n';
import { askForCallDevices, type CallHandle, openCall } from '@/lib/rite';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { mmss } from '../encounters/CallScreen';
import { Ornament } from './festivals';

/**
 * The night at the square (Figma 34:3–34:489, the masked round 47:1168). The engine says which
 * phase this is and when it ends; a `square.updated` event or that moment passing reads it again.
 */
export default function NightScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const night = useGetNight(id).data;
  const [joined, setJoined] = useState<'no' | 'yes' | 'failed'>('no');
  const [leaving, setLeaving] = useState(false);
  const now = useNow();

  useEffect(() => setFireOverride('Roaring'), []);
  // The masked sky (its ember moon) is the live round's own (Figma 47:1168, no header to cross).
  const maskedLive = !!night?.masked && night.phase === 'live';
  useEffect(() => (maskedLive ? setSkyOverride('masked') : undefined), [maskedLive]);

  const save = (v: NightView) => client.setQueryData(getGetNightQueryKey(id), v);
  const join = async () => {
    try {
      save(await joinSquare(id));
      setJoined('yes');
    } catch {
      setJoined('failed');
    }
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: step in once on arrival
  useEffect(() => {
    join();
  }, [id]);

  // The phase ends at a known moment: read the night again then (never a poll).
  const endsAt = night ? Date.parse(night.phaseEndsAt) : 0;
  useEffect(() => {
    if (!endsAt) return;
    const wait = Math.max(250, endsAt - Date.now() + 400);
    const timer = setTimeout(() => client.invalidateQueries({ queryKey: getGetNightQueryKey(id) }), wait);
    return () => clearTimeout(timer);
  }, [endsAt, id, client]);

  const header = <RoomHeader title={t('room.square')} onBack={() => setLeaving(true)} />;
  if (joined === 'failed')
    return (
      <Scene header={header} footer={<Button kind="plain" label={t('night.tryNext')} onPress={join} block />}>
        <Torn title={t('night.failedTitle')} body={t('night.failedBody')} />
      </Scene>
    );
  if (!night) return <Scene header={header}>{null}</Scene>;

  if (leaving)
    return (
      <Scene
        header={header}
        footer={
          <>
            <Button
              label={t('night.leave')}
              onPress={async () => {
                await leaveSquare(id).catch(() => {});
                router.back();
              }}
              block
            />
            <InkLink label={t('night.stay')} onPress={() => setLeaving(false)} />
          </>
        }
      >
        <View style={styles.top}>
          <Txt variant="displayL" engraved align="center" accessibilityRole="header">
            {t('night.leaveTitle')}
          </Txt>
          <Txt variant="voiceM" color="textSecondary" align="center">
            {t('night.leaveBody')}
          </Txt>
        </View>
      </Scene>
    );

  const left = mmss(Math.max(0, endsAt - now));
  const leaveLink = <InkLink label={t('night.leaveLink')} onPress={() => setLeaving(true)} />;
  const isLast = night.round >= night.rounds;

  switch (night.phase) {
    case 'live':
      return <LiveRound night={night} endsAt={endsAt} now={now} onLeave={() => setLeaving(true)} />;
    case 'bell':
    case 'decided':
      return <Bell night={night} header={header} left={left} onDecide={(yes) => decide(id, yes, save)} />;
    case 'result':
      return night.outcome === 'match' ? (
        <View style={styles.fill}>
          {/* Beside the Scene, not in it: a foot ornament inside the scroll body rides up into the words */}
          <Ornament festival={night.festival} masked={night.masked} />
          <Scene header={header} centered footer={leaveLink}>
            <Moment
              art="fires_joined"
              title={t('night.matchTitle')}
              body={t('night.matchBody', { name: night.partner?.name ?? '' })}
              note={t(isLast ? 'night.closesIn' : 'night.nextIn', { left })}
            />
          </Scene>
        </View>
      ) : (
        <Scene header={header} centered footer={leaveLink}>
          <Moment
            art="state_error"
            title={t('night.apartTitle')}
            body={t('night.apartBody')}
            note={t(isLast ? 'night.closesIn' : 'night.nextIn', { left })}
          />
        </Scene>
      );
    case 'closed':
      return (
        <Scene
          header={header}
          centered
          footer={
            <Button
              kind="plain"
              label={t('night.openQuestLog')}
              onPress={() => router.replace('/quests')}
              block
            />
          }
        >
          <Moment
            art="square_bell"
            title={t('night.closedTitle')}
            body={t('night.closedBody', {
              rounds: tCount('night.closedRounds', night.rounds),
              bonds: tCount('night.closedBonds', night.bondsTonight),
            })}
            note={tCount('night.bondsTonight', night.bondsTonight)}
          />
        </Scene>
      );
    case 'left':
    case 'notSeated':
      return (
        <Scene
          header={header}
          footer={<Button kind="plain" label={t('night.tryNext')} onPress={join} block />}
        >
          <Torn title={t('night.failedTitle')} body={t('night.failedBody')} />
        </Scene>
      );
    default: {
      // Filling: before the first bell, or a round with no free table for you.
      const next = night.round === 0 ? 1 : Math.min(night.rounds, night.round + 1);
      return (
        <View style={styles.fill}>
          <Ornament festival={night.festival} masked={night.masked} />
          <Scene header={header} centered footer={leaveLink}>
            <StateBlock
              kind="waiting"
              title={t('night.fillingTitle')}
              body={
                night.round === 0
                  ? t('night.fillingBody', { n: next, rounds: night.rounds })
                  : t('night.sittingOutBody', { n: next, rounds: night.rounds, left })
              }
            />
          </Scene>
        </View>
      );
    }
  }
}

async function decide(id: string, yes: boolean, save: (v: NightView) => void) {
  try {
    save(await decideSquare(id, { yes }));
    feedback(yes ? 'sealStamp' : 'press');
  } catch (e) {
    toast(
      'error',
      e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('error.generic'),
    );
  }
}

/** The bell (Figma 34:87): it swings, its name, and Yes / No — each answer private. */
function Bell({
  night,
  header,
  left,
  onDecide,
}: {
  night: NightView;
  header: React.ReactNode;
  left: string;
  onDecide: (yes: boolean) => void;
}) {
  const chosen = night.myYes;
  return (
    <Scene header={header}>
      <View style={styles.bell}>
        <Swing every={1800} onRing={() => feedback('bell')}>
          <Art name="square_bell" style={styles.bellArt} fit="cover" />
        </Swing>
        <Txt variant="displayL" color="textAccent" align="center" accessibilityRole="header">
          {t(`bell.${Math.min(12, Math.max(1, night.round))}` as StringKey)}
        </Txt>
        <Txt variant="voiceL" color="textSecondary" align="center">
          {night.phase === 'decided' ? t('night.decided', { left }) : t('night.bellLine')}
        </Txt>
      </View>
      <ChoiceCard
        glyph="check"
        title={t('night.yes')}
        body={t('night.yesBody')}
        selected={chosen === true}
        onPress={() => chosen == null && onDecide(true)}
      />
      <ChoiceCard
        glyph="close"
        title={t('night.no')}
        body={t('night.noBody')}
        selected={chosen === false}
        onPress={() => chosen == null && onDecide(false)}
      />
    </Scene>
  );
}

/** A live round (Figma 34:74): their face full, yours in the corner, the round and its clock, the question. */
function LiveRound({
  night,
  endsAt,
  now,
  onLeave,
}: {
  night: NightView;
  endsAt: number;
  now: number;
  onLeave: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [remote, setRemote] = useState<number | null>(null);
  const [lost, setLost] = useState(false);
  const [joined, setJoined] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [footH, setFootH] = useState(0);
  const handle = useRef<CallHandle | null>(null);
  const call = night.call;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new attempt reopens the same table
  useEffect(() => {
    if (!call) return;
    let gone = false;
    askForCallDevices().then((ok) => {
      if (gone || !ok) return;
      handle.current = openCall(
        call,
        {
          onJoined: () => {
            setLost(false);
            setJoined(true);
          },
          onRemote: setRemote,
          onLost: () => setLost(true),
        },
        { camera: !night.masked },
      );
    });
    return () => {
      gone = true;
      handle.current?.leave();
      handle.current = null;
    };
  }, [call?.channel, attempt]);

  if (lost)
    return (
      <Scene
        header={<RoomHeader title={t('room.square')} onBack={onLeave} />}
        footer={
          <>
            <Button
              label={t('night.rejoin')}
              onPress={() => {
                // The faces bind again only once the new call engine says so: a surface left
                // bound to the released one stays black (seen on the emulator).
                setRemote(null);
                setJoined(false);
                setLost(false);
                setAttempt((n) => n + 1);
              }}
              block
            />
            <InkLink label={t('night.leaveLink')} onPress={onLeave} />
          </>
        }
      >
        <Torn title={t('night.lostTitle')} body={t('night.lostBody')} />
      </Scene>
    );

  return (
    // Masked (Figma 47:1168): no face to fill the room, so the masked sky shows through it.
    <View style={[styles.room, night.masked && styles.open]} testID="square-live">
      {night.masked ? (
        <View style={[styles.masked, { bottom: footH + GARLAND }]}>
          <Art name="fest_mask" style={styles.mask} fit="contain" />
          <Txt variant="displayM" engraved align="center">
            {t('night.maskedTitle')}
          </Txt>
          <Txt variant="voiceM" color="textSecondary" align="center">
            {t('night.maskedBody')}
          </Txt>
        </View>
      ) : remote !== null ? (
        <RtcSurfaceView key={attempt} canvas={{ uid: remote }} style={StyleSheet.absoluteFill} />
      ) : (
        <View style={styles.masked}>
          <StateBlock kind="waiting" title={t('night.waitingFace', { name: night.partner?.name ?? '' })} />
        </View>
      )}
      <View style={[styles.bar, { paddingTop: insets.top + dimension.space3 }]}>
        <Txt variant="labelM" color="textSecondary">
          {t(night.masked ? 'night.maskedRound' : 'night.round', {
            n: night.round,
            rounds: night.rounds,
          }).toUpperCase()}
        </Txt>
        <View style={styles.clock}>
          <Txt variant="numberS" color="textAccent">
            {mmss(Math.max(0, endsAt - now))}
          </Txt>
        </View>
      </View>
      {!night.masked ? (
        <View style={[styles.me, { top: insets.top + 64 }]}>
          {/* Your own face binds only once the call engine exists (it is made on joining). */}
          {joined ? (
            <RtcSurfaceView
              key={attempt}
              canvas={{ uid: 0 }}
              zOrderMediaOverlay
              style={StyleSheet.absoluteFill}
            />
          ) : null}
        </View>
      ) : null}
      {night.masked ? (
        // The garland hangs just above the question, never under it.
        <View pointerEvents="none" style={[styles.garland, { bottom: footH }]}>
          <FillArt name="fest_masks" />
        </View>
      ) : null}
      <View
        onLayout={(e) => setFootH(e.nativeEvent.layout.height)}
        style={[
          styles.foot,
          night.masked && styles.open,
          { paddingBottom: insets.bottom + dimension.space4 },
        ]}
      >
        <Txt variant="labelS" color="textMuted">
          {t('night.question').toUpperCase()}
        </Txt>
        <Txt variant="displayS">{night.question}</Txt>
        <InkLink align="start" label={t('night.leaveLink')} onPress={onLeave} />
      </View>
    </View>
  );
}

/** The torn rope over a title and a line: join failed (Figma 34:425) and connection lost (34:489). */
function Torn({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.lost}>
      {/* Cropped like the frame's art slot: the two frayed ends, not the whole rope */}
      <Art name="state_offline" style={styles.moment} />
      <Txt variant="displayL" engraved align="center" accessibilityRole="header">
        {title}
      </Txt>
      <Txt variant="voiceM" color="textSecondary" align="center">
        {body}
      </Txt>
    </View>
  );
}

function Moment({
  art,
  title,
  body,
  note,
}: {
  art: 'fires_joined' | 'state_error' | 'square_bell';
  title: string;
  body: string;
  note?: string;
}) {
  return (
    <View style={styles.momentCol}>
      <Reveal rise={0}>
        <Art name={art} style={styles.moment} fit="contain" />
      </Reveal>
      <Reveal order={1}>
        <Txt variant="displayL" engraved align="center" accessibilityRole="header">
          {title}
        </Txt>
      </Reveal>
      <Reveal order={2}>
        <Txt variant="voiceM" color="textSecondary" align="center">
          {body}
        </Txt>
      </Reveal>
      {note ? (
        <Reveal order={3}>
          <Txt variant="labelS" color="textSecondary" align="center">
            {note.toUpperCase()}
          </Txt>
        </Reveal>
      ) : null}
    </View>
  );
}

/** A clock for countdowns that ticks each second only while it is shown. */
function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

const GARLAND = 100;

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { alignItems: 'center', gap: dimension.space4, paddingTop: dimension.space7 },
  bell: {
    alignItems: 'center',
    gap: dimension.space4,
    paddingTop: dimension.space7,
    paddingBottom: dimension.space2,
  },
  bellArt: { width: 120, height: 120, borderRadius: 60 },
  momentCol: { alignItems: 'center', gap: dimension.space4 },
  moment: { width: 140, height: 140 },
  lost: { alignItems: 'center', gap: 14, paddingTop: 90 },
  room: { flex: 1, backgroundColor: color.bgSunken },
  open: { backgroundColor: 'transparent' },
  garland: { position: 'absolute', left: 0, right: 0, height: GARLAND, opacity: 0.5 },
  masked: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: dimension.space4,
    padding: dimension.sizeGutter,
  },
  mask: { width: 260, height: 300 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: dimension.sizeGutter,
  },
  clock: { paddingHorizontal: dimension.space3, paddingVertical: 6, backgroundColor: color.bgSunken },
  me: {
    position: 'absolute',
    right: dimension.sizeGutter,
    width: 110,
    height: 150,
    borderRadius: dimension.radiusMd,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderGold,
    overflow: 'hidden',
    backgroundColor: color.bgPanel,
  },
  foot: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 6,
    paddingHorizontal: dimension.sizeGutter,
    paddingTop: dimension.space4,
    backgroundColor: color.bgSunken,
  },
});
