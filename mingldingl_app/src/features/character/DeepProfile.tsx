import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { Button } from '@/design/components/Button';
import { PickRow } from '@/design/components/PickRow';
import { RoomHeader } from '@/design/components/RoomHeader';
import { SettingRow } from '@/design/components/SettingRow';
import { Txt } from '@/design/components/Txt';
import type { GlyphName } from '@/design/glyphs';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import { getGetDeepProfileQueryKey, setDeepProfile, useGetDeepProfile } from '@/lib/api/generated/engine';
import type { DeepView } from '@/lib/api/generated/model';
import { type StringKey, t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';

/** The five questions and their answers, in the engine's order (Profile/DeepProfile.cs). */
export const DEEP: { field: keyof DeepView; glyph: GlyphName; choices: string[] }[] = [
  { field: 'children', glyph: 'person', choices: ['has', 'wants', 'doesNotWant', 'notSure', 'ratherNot'] },
  { field: 'smoking', glyph: 'fire', choices: ['never', 'sometimes', 'daily', 'ratherNot'] },
  { field: 'drinking', glyph: 'goblet', choices: ['never', 'withFriends', 'often', 'ratherNot'] },
  {
    field: 'faith',
    glyph: 'temple',
    choices: ['buddhist', 'shamanic', 'christian', 'muslim', 'none', 'other', 'ratherNot'],
  },
  {
    field: 'lifestyle',
    glyph: 'mountain',
    choices: ['outdoors', 'city', 'homebody', 'traveller', 'ratherNot'],
  },
];

export const deepTitle = (field: string) => t(`deep.${field}` as StringKey);
export const deepAnswer = (field: string, value: string) => t(`deep.${field}.${value}` as StringKey);

/**
 * The deep profile (Figma 35:285; sealed for the Yard 35:475). Members fill it; another member reads
 * it after the fourth seal. The game is the same for everyone.
 */
export default function DeepProfile() {
  const deep = useGetDeepProfile().data;
  const header = <RoomHeader title={t('room.character')} onBack={router.back} />;
  if (!deep) return <Scene header={header}>{null}</Scene>;
  if (!deep.open)
    return (
      <Scene
        header={header}
        footer={<Button label={t('seek.restsLink')} onPress={() => router.replace('/guild-house')} block />}
      >
        <View style={styles.sealed}>
          <Art name="guild_seal" style={styles.art} />
          <Txt variant="displayL" engraved align="center" accessibilityRole="header">
            {t('deep.sealedTitle')}
          </Txt>
          <Txt variant="voiceM" color="textSecondary" align="center">
            {t('deep.sealedBody')}
          </Txt>
        </View>
      </Scene>
    );
  return (
    <Scene header={header}>
      <View style={styles.head}>
        <Txt variant="displayL" engraved accessibilityRole="header">
          {t('deep.title')}
        </Txt>
        <Txt variant="voiceM" color="textSecondary">
          {t('deep.body')}
        </Txt>
      </View>
      <View style={styles.rows}>
        {DEEP.map((q) => {
          const v = deep.answers[q.field];
          return (
            <SettingRow
              key={q.field}
              glyph={q.glyph}
              title={deepTitle(q.field)}
              value={v ? deepAnswer(q.field, v) : t('deep.unanswered')}
              onPress={() => router.push(`/deep/${q.field}` as never)}
            />
          );
        })}
      </View>
    </Scene>
  );
}

/** One question's answers (Figma 35:392); choosing saves and goes back. */
export function DeepPicker() {
  const { field } = useLocalSearchParams<{ field: string }>();
  const q = DEEP.find((d) => d.field === field);
  const current = useGetDeepProfile().data?.answers[q?.field ?? 'children'];
  const client = useQueryClient();
  if (!q) return null;
  const pick = async (value: string) => {
    try {
      const saved = await setDeepProfile({
        children: null,
        smoking: null,
        drinking: null,
        faith: null,
        lifestyle: null,
        [q.field]: value,
      });
      // The engine's answer is the new truth; profile.updated says the same a moment later.
      client.setQueryData(getGetDeepProfileQueryKey(), saved);
      router.back();
    } catch (e) {
      toast('error', e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'));
    }
  };
  return (
    <Scene header={<RoomHeader title={t('room.character')} onBack={router.back} />}>
      <Txt variant="displayL" engraved accessibilityRole="header" style={styles.pickTitle}>
        {deepTitle(q.field)}
      </Txt>
      <View style={styles.rows}>
        {q.choices.map((c) => (
          <PickRow key={c} label={deepAnswer(q.field, c)} selected={current === c} onPress={() => pick(c)} />
        ))}
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  sealed: { alignItems: 'center', gap: 14, paddingTop: 94, paddingHorizontal: 5 },
  art: { width: 140, height: 140 },
  head: { gap: dimension.space2, paddingTop: dimension.space2, marginBottom: dimension.space3 },
  rows: { marginHorizontal: -dimension.sizeGutter },
  pickTitle: { paddingTop: dimension.space2, marginBottom: dimension.space3 },
});
