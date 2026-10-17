import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { InkLink } from '@/design/components/InkLink';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { ApiError } from '@/lib/api/client';
import { keepCharacter, useGetMe } from '@/lib/api/generated/engine';
import { t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { moonLine } from '../common/time';

const DAY_MS = 86_400_000;

/** Whole days left before the burn, never below one while it is still pending. */
export const daysLeft = (deleteAt: string, now = Date.now()) =>
  Math.max(1, Math.ceil((Date.parse(deleteAt) - now) / DAY_MS));

/** "the 4th of the eleventh moon" — the world's calendar (common/time). */
export const moonDate = (iso: string) => moonLine('departing.on', iso);

export async function keep() {
  try {
    await keepCharacter();
    toast('info', t('departing.kept'));
  } catch (e) {
    toast('error', e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'));
  }
}

/** Deletion scheduled (Figma 35:1121): the fire burning low, the day it goes out, and the way back. */
export default function Departing() {
  const deleteAt = useGetMe().data?.deleteAt;
  return (
    <Scene
      header={<RoomHeader title={t('room.warRoom')} onBack={router.back} />}
      footer={
        deleteAt ? (
          <InkLink
            label={t('abandon.keep')}
            onPress={() => keep().then(() => router.dismissTo('/war-room'))}
          />
        ) : undefined
      }
    >
      {deleteAt ? (
        <View style={styles.body}>
          <Art name="state_error" style={styles.fire} fit="contain" />
          <Txt variant="displayL" engraved align="center" accessibilityRole="header">
            {t('departing.title')}
          </Txt>
          <Txt variant="voiceM" color="textSecondary" align="center">
            {t('departing.body', { days: daysLeft(deleteAt) })}
          </Txt>
          <Txt variant="labelS" color="textMuted" align="center">
            {moonDate(deleteAt).toUpperCase()}
          </Txt>
        </View>
      ) : null}
    </Scene>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: 14, paddingTop: 94, paddingHorizontal: 5 },
  fire: { width: 140, height: 140 },
});
