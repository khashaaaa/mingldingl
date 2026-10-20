import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SectionLabel } from '@/design/components/Banner';
import { Dialog } from '@/design/components/Dialog';
import { PickRow } from '@/design/components/PickRow';
import { RoomHeader } from '@/design/components/RoomHeader';
import { SettingRow } from '@/design/components/SettingRow';
import { Sheet } from '@/design/components/Sheet';
import { Toggle } from '@/design/components/Toggle';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import {
  abandonCharacter,
  signOut,
  useGetAppStatus,
  useGetMe,
  useGetMembership,
} from '@/lib/api/generated/engine';
import type { MembershipView } from '@/lib/api/generated/model';
import { deviceFeel, saveHapticsSetting, saveSoundSetting } from '@/lib/feedback';
import { type StringKey, t, tError, useLocale } from '@/lib/i18n';
import { chooseLocale } from '@/lib/i18n/device';
import { onApple } from '@/lib/links';
import { pushIsOn, setPushOn } from '@/lib/push';
import { queryClient } from '@/lib/query';
import { signOutLocally } from '@/lib/session';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { weekday } from '../common/time';
import { patchMe } from '../onboarding/Onboarding';

/** Each language under its own name: never translated. */
const LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'mn', name: 'Монгол' },
] as const;

const FLOOR_LINE: Record<string, StringKey> = {
  yard: 'war.floorYard',
  hall: 'war.floorHall',
  highTable: 'war.floorHighTable',
};

/** A paid floor ends with the character: said plainly before anyone confirms (Figma 216:4654). */
function paidNote(m: MembershipView | undefined): string | null {
  // A gift from the keepers was never paid for.
  if (!m || m.floor === 'yard' || m.source === 'keeper') return null;
  const floor = t(m.floor === 'highTable' ? 'guild.highTable' : 'guild.hall');
  const store = onApple ? 'abandon.paidFloorAppStore' : 'abandon.paidFloor';
  return t(m.source === 'store' ? store : 'abandon.paidFloorWeb', { floor });
}

const failed = (e: unknown) =>
  toast('error', e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'));

/**
 * The War Room (Figma 35:3): your character, the world's feel on this device, the Guild House,
 * help, signing out and the way out. Sound, haptics and notifications are per device; pause and language travel
 * with the character.
 */
export default function WarRoom() {
  const me = useGetMe().data;
  const app = useGetAppStatus().data;
  const membership = useGetMembership().data?.membership;
  const locale = useLocale();
  const [feel, setFeel] = useState(deviceFeel);
  const [push, setPush] = useState<boolean | null>(null);
  const [languages, setLanguages] = useState(false);
  const [abandon, setAbandon] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    pushIsOn().then(setPush, () => setPush(false));
  }, []);

  const profile = me?.profile;
  if (!me || !profile) return <Scene>{null}</Scene>;

  return (
    <>
      <Scene header={<RoomHeader title={t('room.warRoom')} onBack={router.back} />}>
        <View style={styles.rows}>
          <SectionLabel text={t('war.yourCharacter')} />
          <SettingRow
            glyph="person"
            title={t('war.edit')}
            subtitle={t('war.editHint')}
            onPress={() => router.push('/character-edit')}
          />
          <SettingRow
            glyph="moon"
            title={t('war.pause')}
            subtitle={t('war.pauseHint')}
            control={
              <Toggle
                label={t('war.pause')}
                value={profile.paused}
                onChange={(paused) => patchMe({ paused }).catch(failed)}
              />
            }
          />
          <SettingRow
            glyph="night"
            title={t('war.away')}
            subtitle={t('war.awayHint')}
            value={
              profile.awayUntil ? t('war.awayUntil', { day: weekday(profile.awayUntil) }) : t('war.awayOff')
            }
            onPress={() => router.push('/away' as never)}
          />
          <SettingRow
            glyph="seal"
            title={t('war.sigil')}
            subtitle={t('war.sigilHint')}
            value={t('war.sigilValue', { digits: me.phoneHint })}
            onPress={() => router.push('/sigil')}
          />

          <SectionLabel text={t('war.world')} />
          <SettingRow
            glyph="bell"
            title={t('war.sound')}
            subtitle={t('war.soundHint')}
            control={
              <Toggle
                label={t('war.sound')}
                value={feel.sound}
                onChange={(on) => {
                  setFeel((f) => ({ ...f, sound: on }));
                  saveSoundSetting(on);
                }}
              />
            }
          />
          <SettingRow
            glyph="spark"
            title={t('war.haptics')}
            control={
              <Toggle
                label={t('war.haptics')}
                value={feel.haptics}
                onChange={(on) => {
                  setFeel((f) => ({ ...f, haptics: on }));
                  saveHapticsSetting(on);
                }}
              />
            }
          />
          <SettingRow
            glyph="letters"
            title={t('war.language')}
            value={LANGUAGES.find((l) => l.code === locale)?.name ?? LANGUAGES[0].name}
            onPress={() => setLanguages(true)}
          />
          <SettingRow
            glyph="horn"
            title={t('war.notifications')}
            subtitle={t('war.notificationsHint')}
            control={
              <Toggle
                label={t('war.notifications')}
                value={push ?? false}
                disabled={push === null}
                onChange={(on) => {
                  setPush(on);
                  setPushOn(on).then(setPush, () => setPush(false));
                }}
              />
            }
          />

          <SectionLabel text={t('war.guild')} />
          <SettingRow
            glyph="crown"
            title={t('war.floor')}
            subtitle={t(FLOOR_LINE[membership?.floor ?? 'yard'] ?? 'war.floorYard')}
            value={(membership?.floor ?? 'yard') === 'yard' ? t('war.floorClimb') : undefined}
            onPress={() => router.push('/guild-house')}
          />

          <SectionLabel text={t('war.help')} />
          <SettingRow
            glyph="book"
            title={t('war.codex')}
            subtitle={t('war.codexHint')}
            onPress={() => router.push('/codex')}
          />
          <SettingRow
            glyph="frost"
            title={t('war.frozenGate')}
            subtitle={t('war.frozenGateHint')}
            onPress={() => router.push('/frozen-gate')}
          />
          <SettingRow glyph="page" title={t('war.terms')} onPress={() => router.push('/codex/terms')} />
          <SettingRow
            glyph="door"
            title={t('war.signOut')}
            subtitle={t('war.signOutHint')}
            onPress={() => setLeaving(true)}
          />
          <SettingRow
            glyph="swords"
            title={t('war.abandon')}
            subtitle={t('war.abandonHint')}
            onPress={() => (me.deleteAt ? router.push('/departing') : setAbandon(true))}
          />
        </View>
      </Scene>
      <Sheet kind="menu" open={languages} title={t('war.language')} onClose={() => setLanguages(false)}>
        {LANGUAGES.map((l) => (
          <PickRow
            key={l.code}
            label={l.name}
            selected={locale === l.code}
            onPress={() => {
              setLanguages(false);
              chooseLocale(l.code);
              // The engine writes pushes, questions and prompts in the profile's language: once it
              // knows the new one, what is cached in the old is fetched again.
              patchMe({ locale: l.code })
                .then(() => queryClient.invalidateQueries())
                .catch(failed);
            }}
          />
        ))}
      </Sheet>
      <Dialog
        open={leaving}
        title={t('signOut.title')}
        body={t('signOut.body')}
        confirm={{
          label: t('signOut.confirm'),
          onPress: () => {
            setLeaving(false);
            // This device's session ends on the engine too; offline, the phone still forgets it.
            signOut()
              .catch(() => {})
              .finally(signOutLocally);
          },
        }}
        cancel={{ label: t('signOut.stay'), onPress: () => setLeaving(false) }}
      />
      <Dialog
        open={abandon}
        title={t('abandon.title')}
        body={[t('abandon.body', { days: app?.deleteDays ?? 30 }), paidNote(membership)]
          .filter(Boolean)
          .join('\n\n')}
        confirm={{
          label: t('abandon.confirm'),
          danger: true,
          onPress: () => {
            setAbandon(false);
            abandonCharacter()
              .then(() => router.push('/departing'))
              .catch(failed);
          },
        }}
        cancel={{ label: t('abandon.keep'), onPress: () => setAbandon(false) }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Rows run edge to edge, past the Scene's gutter.
  rows: { marginHorizontal: -dimension.sizeGutter, marginTop: -dimension.space4 },
});
