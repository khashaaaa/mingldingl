import { useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Banner } from '@/design/components/Banner';
import { Button } from '@/design/components/Button';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
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

/** The front camera, never the gallery: a selfie has to be taken now. */
async function takeSelfie(): Promise<string | null> {
  const picked = await ImagePicker.launchCameraAsync({
    cameraType: ImagePicker.CameraType.front,
    mediaTypes: ['images'],
    quality: 0.85,
    base64: true,
  });
  return picked.canceled ? null : (picked.assets[0]?.base64 ?? null);
}

type Step = { kind: 'intro' } | { kind: 'turn'; straight: string } | { kind: 'sending' };

/**
 * Prove your face: one selfie looking straight on, one with the head turned the way the engine asks,
 * both from the camera. The engine compares them with the portraits and keeps only the answer; on a
 * match the mark shows on the card. Optional, a few tries a day.
 */
export default function FaceProof() {
  const client = useQueryClient();
  const status = useGetFaceProof().data;
  const [step, setStep] = useState<Step>({ kind: 'intro' });
  const [missed, setMissed] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);

  const camera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    setDenied(!perm.granted);
    return perm.granted ? takeSelfie() : null;
  };

  const first = async () => {
    setMissed(null);
    const straight = await camera();
    if (straight) setStep({ kind: 'turn', straight });
  };

  const second = async (straight: string) => {
    const turned = await camera();
    if (!turned) return;
    setStep({ kind: 'sending' });
    try {
      const r = await proveFace({
        straight: selfiePart(straight, 'straight.jpg'),
        turned: selfiePart(turned, 'turned.jpg'),
      });
      client.setQueryData<FaceProofView>(getGetFaceProofQueryKey(), r.status);
      if (r.outcome === 'proven') client.invalidateQueries({ queryKey: getGetMeQueryKey(), exact: true });
      else setMissed(r.outcome);
    } catch (e) {
      // A rule (no tries left, the check closed) says why; a lost request says try again.
      setMissed(e instanceof ApiError && e.kind === 'rule' ? `code:${e.code}` : 'lost');
      client.invalidateQueries({ queryKey: getGetFaceProofQueryKey(), exact: true });
    }
    setStep({ kind: 'intro' });
  };

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
  const missedLine = missed?.startsWith('code:')
    ? tError(missed.slice(5), t('error.generic'))
    : missed && MISSED[missed]
      ? t(MISSED[missed])
      : missed
        ? t('error.generic')
        : null;

  return (
    <Scene
      header={header}
      footer={
        step.kind === 'turn' ? (
          <Button block label={t('face.takeTurned', { side })} onPress={() => second(step.straight)} />
        ) : (
          <Button
            block
            label={t(missed ? 'face.again' : 'face.takeStraight')}
            loading={step.kind === 'sending'}
            disabled={out}
            onPress={first}
          />
        )
      }
    >
      <Txt variant="displayL" engraved accessibilityRole="header" style={styles.title}>
        {t('face.title')}
      </Txt>
      <Txt variant="bodyL" color="textSecondary">
        {step.kind === 'turn' ? t('face.turnNow', { side }) : t('face.body', { side })}
      </Txt>
      <View style={styles.notes}>
        {missedLine ? <Banner text={missedLine} /> : null}
        {denied ? <Banner glyph="shield" tint="textSecondary" text={t('face.cameraDenied')} /> : null}
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
  notes: { marginTop: dimension.space4, gap: dimension.space3 },
});
