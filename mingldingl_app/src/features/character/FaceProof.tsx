import { useQueryClient } from '@tanstack/react-query';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Banner } from '@/design/components/Banner';
import { Button } from '@/design/components/Button';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { color, dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import {
  getGetFaceProofQueryKey,
  getGetMeQueryKey,
  proveFace,
  useGetFaceProof,
} from '@/lib/api/generated/engine';
import type { FaceProofView } from '@/lib/api/generated/model';
import { type StringKey, t, tCount, tError } from '@/lib/i18n';
import { Scene } from '../common/Scene';

/** The engine's answer for a try that did not prove the face → what the person reads. */
const MISSED: Record<string, StringKey> = {
  noFace: 'face.noFace',
  turn: 'face.notTurned',
  notYou: 'face.notYou',
};

/** As the portraits go up: a Blob-like part expo/fetch accepts (see usePortraits). */
const selfiePart = (base64: string, name: string) =>
  ({
    name,
    type: 'image/jpeg',
    bytes: async () => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
  }) as unknown as Blob;

/** Seconds the person has to turn their head before the second selfie takes itself. */
export const TURN_SECONDS = 3;

type Step = { kind: 'ready' } | { kind: 'turn'; left: number } | { kind: 'sending' };

/**
 * Prove your face: the front camera is live as the room opens. One tap takes the selfie looking
 * straight on; then the engine's side is asked and a shot is taken at each tick of a short count
 * while the head turns, so the whole check is one tap. The engine compares them with the portraits and keeps only
 * the answer; on a match the mark shows on the card. Optional, a few tries a day.
 */
export default function FaceProof() {
  const client = useQueryClient();
  const status = useGetFaceProof().data;
  const [perm, askPerm] = useCameraPermissions();
  const lens = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [step, setStep] = useState<Step>({ kind: 'ready' });
  const [missed, setMissed] = useState<string | null>(null);
  const gone = useRef(false);
  useEffect(
    () => () => {
      gone.current = true;
    },
    [],
  );

  // Ask for the camera once, as the room opens, so the preview is there at once.
  useEffect(() => {
    if (perm && !perm.granted && perm.canAskAgain) askPerm();
  }, [perm, askPerm]);

  const snap = async () => {
    const shot = await lens.current?.takePictureAsync({ base64: true, quality: 0.85, shutterSound: false });
    return shot?.base64 ?? null;
  };

  const send = async (straight: string, turned: string[]) => {
    setStep({ kind: 'sending' });
    try {
      const r = await proveFace({
        straight: selfiePart(straight, 'straight.jpg'),
        turned: turned.map((t, i) => selfiePart(t, `turned${i}.jpg`)),
      });
      client.setQueryData<FaceProofView>(getGetFaceProofQueryKey(), r.status);
      if (r.outcome === 'proven') client.invalidateQueries({ queryKey: getGetMeQueryKey(), exact: true });
      else setMissed(r.outcome);
    } catch (e) {
      // A rule (no tries left, the check closed) says why; a lost request says try again.
      setMissed(e instanceof ApiError && e.kind === 'rule' ? `code:${e.code}` : 'lost');
      client.invalidateQueries({ queryKey: getGetFaceProofQueryKey(), exact: true });
    }
    setStep({ kind: 'ready' });
  };

  const begin = async () => {
    setMissed(null);
    const straight = await snap().catch(() => null);
    if (!straight) return setMissed('lost');
    // The count while the head turns, a shot at every tick: a person turns at their own pace, so the
    // engine judges the most turned of them.
    const turned: string[] = [];
    for (let left = TURN_SECONDS; left > 0; left--) {
      setStep({ kind: 'turn', left });
      await new Promise((r) => setTimeout(r, 1000));
      if (gone.current) return;
      const shot = await snap().catch(() => null);
      if (shot) turned.push(shot);
    }
    if (turned.length) return send(straight, turned);
    setMissed('lost');
    setStep({ kind: 'ready' });
  };
  const turning = step.kind === 'turn' ? step : null;

  const header = <RoomHeader title={t('room.character')} onBack={router.back} />;
  if (!status) return <Scene header={header}>{null}</Scene>;

  if (status.proven) {
    return (
      <Scene header={header}>
        <Txt variant="displayL" engraved accessibilityRole="header" style={styles.title}>
          {t('face.provenTitle')}
        </Txt>
        <Txt variant="bodyL" color="textSecondary">
          {t('face.provenBody')}
        </Txt>
      </Scene>
    );
  }

  const side = t(status.turn === 'left' ? 'face.left' : 'face.right');
  const out = status.triesLeft <= 0;
  const seeing = perm?.granted === true;
  const missedLine = missed?.startsWith('code:')
    ? tError(missed.slice(5), t('error.generic'))
    : missed && MISSED[missed]
      ? t(MISSED[missed])
      : missed
        ? t('error.generic')
        : null;

  const footer = !seeing ? (
    <Button
      block
      label={t('face.allowCamera')}
      onPress={() => (perm?.canAskAgain === false ? Linking.openSettings() : askPerm())}
    />
  ) : (
    <Button
      block
      label={t(missed ? 'face.again' : 'face.begin')}
      loading={step.kind !== 'ready'}
      disabled={out || !ready}
      onPress={begin}
    />
  );

  return (
    <Scene header={header} footer={out ? undefined : footer}>
      <Txt variant="displayL" engraved accessibilityRole="header" style={styles.title}>
        {t('face.title')}
      </Txt>
      {seeing && !out ? (
        <View style={styles.lens}>
          <CameraView
            ref={lens}
            style={StyleSheet.absoluteFill}
            facing="front"
            animateShutter={false}
            onCameraReady={() => setReady(true)}
          />
          {turning ? (
            <View style={styles.count} pointerEvents="none">
              <View style={styles.dim} />
              <Txt variant="displayL" engraved align="center">
                {t(status.turn === 'left' ? 'face.turnLeftShort' : 'face.turnRightShort')}
              </Txt>
              <Txt variant="displayXL" engraved align="center" accessibilityLiveRegion="polite">
                {String(turning.left)}
              </Txt>
            </View>
          ) : null}
        </View>
      ) : null}
      <Txt variant="bodyL" color={turning ? 'textAccent' : 'textSecondary'} accessibilityLiveRegion="polite">
        {turning ? t('face.turnNow', { side }) : t('face.body', { side })}
      </Txt>
      <View style={styles.notes}>
        {missedLine ? <Banner text={missedLine} /> : null}
        {perm && !seeing ? (
          <Banner glyph="shield" tint="textSecondary" text={t('face.cameraDenied')} />
        ) : null}
        <Banner
          glyph="candle"
          tint="textSecondary"
          text={out ? t('face.noTries') : tCount('face.triesLeft', status.triesLeft)}
        />
        <Banner glyph="shield" tint="textSecondary" text={t('face.perks')} />
        <Banner glyph="wax" tint="textSecondary" text={t('face.privacy')} />
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: dimension.space2, marginBottom: dimension.space3 },
  lens: {
    width: '72%',
    aspectRatio: 3 / 4,
    alignSelf: 'center',
    marginBottom: dimension.space4,
    borderRadius: dimension.radiusLg,
    borderWidth: 1,
    borderColor: color.borderBrass,
    overflow: 'hidden',
    backgroundColor: color.bgSunken,
  },
  count: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    gap: dimension.space2,
  },
  // Dims the preview under the words so they read on a bright wall.
  dim: { ...StyleSheet.absoluteFill, backgroundColor: color.bgScrim, opacity: 0.45 },
  notes: { marginTop: dimension.space4, gap: dimension.space3 },
});
