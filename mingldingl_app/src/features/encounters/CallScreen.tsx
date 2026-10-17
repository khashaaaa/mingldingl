import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { RtcSurfaceView } from 'react-native-agora';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Glyph } from '@/design/components/Art';
import { Dialog } from '@/design/components/Dialog';
import { InkLink } from '@/design/components/InkLink';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StateBlock } from '@/design/components/StateBlock';
import { Txt } from '@/design/components/Txt';
import { withAlpha } from '@/design/effects';
import type { GlyphName } from '@/design/glyphs';
import { color, dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import {
  douseCall,
  getGetEncounterQueryKey,
  reportPresence,
  startCall,
  useGetBond,
  useGetEncounter,
} from '@/lib/api/generated/engine';
import type { CallTicket } from '@/lib/api/generated/model';
import { feedback } from '@/lib/feedback';
import { t, tError } from '@/lib/i18n';
import { askForCallDevices, type CallHandle, openCall } from '@/lib/rite';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';

type Phase = 'connecting' | 'live' | 'lost';

/** "3:42" */
export const mmss = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/**
 * The Rite, live (Figma 33:1120 · 33:1141 kindling · 33:1210 the way would not open · 33:1279 douse):
 * their face full screen, mine in the corner, five minutes counted from when both are in (the
 * engine's clock), ending itself at 0:00. Nothing is recorded.
 */
export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const insets = useSafeAreaInsets();
  const name = useGetBond(id).data?.other.name ?? '';
  const encounter = useGetEncounter(id).data;
  const [phase, setPhase] = useState<Phase>('connecting');
  const [remote, setRemote] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [camera, setCamera] = useState(true);
  const [douse, setDouse] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const call = useRef<{ ticket: CallTicket; handle: CallHandle } | null>(null);

  const presence = useCallback((joined: boolean) => {
    // Development only: there Agora's webhook cannot reach the engine, so the app reports itself.
    const c = call.current;
    if (__DEV__ && c) reportPresence(c.ticket.callId, { joined }).catch(() => {});
  }, []);

  const leave = useCallback(() => {
    const c = call.current;
    if (!c) return;
    presence(false);
    c.handle.leave();
    call.current = null;
  }, [presence]);

  // Step in (again, after "Try again"): devices, a ticket from the engine, then the channel.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` is how "Try again" steps in anew
  useEffect(() => {
    let gone = false;
    setPhase('connecting');
    setRemote(null);
    (async () => {
      if (!(await askForCallDevices())) {
        toast('error', t('call.permission'));
        router.back();
        return;
      }
      try {
        const ticket = await startCall(id);
        if (gone) return;
        const handle = openCall(ticket, {
          onJoined: () => presence(true),
          onRemote: (uid) => {
            setRemote(uid);
            if (uid !== null) {
              setPhase('live');
              feedback('emberFlare');
            }
          },
          onLost: () => setPhase('lost'),
        });
        call.current = { ticket, handle };
      } catch (e) {
        toast(
          'error',
          e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('error.generic'),
        );
        router.back();
      }
    })();
    return () => {
      gone = true;
      leave();
    };
  }, [id, attempt, leave, presence]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  const endsAt = encounter?.rite?.call?.endsAt ? Date.parse(encounter.rite.call.endsAt) : null;
  const finish = useCallback(() => {
    leave();
    client.invalidateQueries({ queryKey: getGetEncounterQueryKey(id) });
    router.replace(`/rite/${id}`);
  }, [client, id, leave]);

  // 0:00 ends it for both; so does the other side dousing (the engine ends the attempt).
  const over = phase === 'live' && ((endsAt !== null && now >= endsAt) || encounter?.rite?.call === null);
  useEffect(() => {
    if (over) finish();
  }, [over, finish]);

  const doDouse = async () => {
    setDouse(false);
    try {
      client.setQueryData(getGetEncounterQueryKey(id), await douseCall(id));
    } catch {
      // the call ends here either way
    }
    finish();
  };

  const header = <RoomHeader title={t('room.rite')} onBack={() => router.back()} />;

  if (phase === 'lost')
    return (
      <Scene
        header={header}
        centered
        footer={<InkLink label={t('common.backToLetters')} onPress={() => router.back()} />}
      >
        <StateBlock
          kind="offline"
          title={t('call.lostTitle')}
          body={t('call.lostBody')}
          action={{
            label: t('call.tryAgain'),
            onPress: () => {
              leave();
              setAttempt((n) => n + 1);
            },
          }}
        />
      </Scene>
    );

  if (phase === 'connecting')
    return (
      <Scene
        header={header}
        centered
        footer={<InkLink label={t('call.cancel')} onPress={() => router.back()} />}
      >
        <StateBlock
          kind="waiting"
          title={t('call.connectingTitle')}
          body={t('call.connectingBody', { name })}
        />
      </Scene>
    );

  return (
    <View style={styles.room} testID="rite-live">
      {remote !== null && <RtcSurfaceView canvas={{ uid: remote }} style={StyleSheet.absoluteFill} />}
      {/* 33:1120: the night shades the top and the foot of their face, so the name and controls read */}
      <Shade top />
      <Shade />
      <View style={[styles.top, { paddingTop: insets.top + dimension.space3 }]}>
        <Txt variant="displayS">{name}</Txt>
        <View style={styles.timer} accessibilityLabel={endsAt ? mmss(endsAt - now) : undefined}>
          <View style={styles.dot} />
          <Txt variant="numberS" color="accentGoldBright">
            {endsAt ? mmss(endsAt - now) : '—'}
          </Txt>
        </View>
      </View>
      <View style={[styles.me, { top: insets.top + 72 }]}>
        {camera && <RtcSurfaceView canvas={{ uid: 0 }} zOrderMediaOverlay style={StyleSheet.absoluteFill} />}
      </View>
      <View style={[styles.controls, { paddingBottom: insets.bottom + dimension.space5 }]}>
        <Control
          glyph="eye"
          label={camera ? t('call.cameraOff') : t('call.cameraOn')}
          onPress={() => {
            call.current?.handle.camera(!camera);
            setCamera(!camera);
          }}
          off={!camera}
        />
        <Control glyph="flame" label={t('call.end')} onPress={() => setDouse(true)} fire />
        <Control
          glyph="horn"
          label={muted ? t('call.unmute') : t('call.mute')}
          onPress={() => {
            call.current?.handle.mute(!muted);
            setMuted(!muted);
          }}
          off={muted}
        />
      </View>
      <Dialog
        open={douse}
        title={t('call.douseTitle')}
        body={t('call.douseBody')}
        confirm={{ label: t('call.douse'), onPress: doDouse, danger: true }}
        cancel={{ label: t('call.stay'), onPress: () => setDouse(false) }}
      />
    </View>
  );
}

function Control({
  glyph,
  label,
  onPress,
  fire,
  off,
}: {
  glyph: GlyphName;
  label: string;
  onPress: () => void;
  fire?: boolean;
  off?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.control, fire ? styles.fire : styles.ring, off && styles.off]}
    >
      <Glyph name={glyph} size={24} tint={fire ? 'textPrimary' : 'textAccent'} />
    </Pressable>
  );
}

const CONTROL = 52;
const SHADE = [withAlpha(color.bgBase, 0.85), withAlpha(color.bgBase, 0)];

/** Night falling over the top (or the foot) of the video, drawn by Skia like the World Floor. */
function Shade({ top }: { top?: boolean }) {
  const { width } = useWindowDimensions();
  const h = top ? 140 : 170;
  return (
    <Canvas
      pointerEvents="none"
      style={[styles.shade, top ? styles.shadeTop : styles.shadeFoot, { height: h }]}
    >
      <Rect x={0} y={0} width={width} height={h}>
        <LinearGradient start={vec(0, top ? 0 : h)} end={vec(0, top ? h : 0)} colors={SHADE} />
      </Rect>
    </Canvas>
  );
}

const styles = StyleSheet.create({
  room: { flex: 1, backgroundColor: color.bgSunken },
  shade: { position: 'absolute', left: 0, right: 0 },
  shadeTop: { top: 0 },
  shadeFoot: { bottom: 0 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: dimension.sizeGutter,
  },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space2,
    paddingHorizontal: dimension.space3,
    paddingVertical: dimension.space1,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderGold,
    backgroundColor: color.bgPanel,
  },
  dot: { width: 8, height: 12, borderRadius: 4, backgroundColor: color.accentEmber },
  me: {
    position: 'absolute',
    right: dimension.sizeGutter,
    width: 110,
    height: 150,
    borderRadius: 4,
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderGold,
    backgroundColor: color.bgPanel,
    overflow: 'hidden',
  },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 40,
  },
  control: {
    width: CONTROL,
    height: CONTROL,
    borderRadius: CONTROL / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    borderWidth: dimension.strokeHairline,
    borderColor: color.borderGold,
    backgroundColor: color.bgPanel,
  },
  fire: { backgroundColor: color.accentEmber },
  off: { opacity: 0.5 },
});
