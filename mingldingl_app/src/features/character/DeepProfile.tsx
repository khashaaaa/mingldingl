import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Banner } from '@/design/components/Banner';
import { Button } from '@/design/components/Button';
import { PickRow } from '@/design/components/PickRow';
import { RoomHeader } from '@/design/components/RoomHeader';
import { SettingRow } from '@/design/components/SettingRow';
import { Toggle } from '@/design/components/Toggle';
import { Txt } from '@/design/components/Txt';
import type { GlyphName } from '@/design/glyphs';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import { getGetDeepProfileQueryKey, setDeepProfile, useGetDeepProfile } from '@/lib/api/generated/engine';
import type { DeepUpdateRequest, DeepView, MyDeepView } from '@/lib/api/generated/model';
import { type StringKey, t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';

/**
 * The questions and their answers, in the engine's order (Profile/DeepProfile.cs). `open`: anyone may
 * answer it (whether they have children); the rest are the Hall's.
 */
export const DEEP: { field: keyof DeepView; glyph: GlyphName; choices: string[]; open?: boolean }[] = [
  { field: 'hasChildren', glyph: 'person', choices: ['yes', 'no', 'ratherNot'], open: true },
  { field: 'wantsChildren', glyph: 'spark', choices: ['yes', 'no', 'notSure', 'ratherNot'] },
  { field: 'partnerChildren', glyph: 'hearth', choices: ['welcome', 'open', 'preferNot', 'ratherNot'] },
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
/** The picker's wording, where it reads as the person's own answer ("I have children"). */
const deepPick = (field: string, value: string) =>
  field === 'hasChildren' ? t(`deep.hasChildren.pick.${value}` as StringKey) : deepAnswer(field, value);

/** Nothing changes but what is set: every field the engine is not to touch is null. */
const UNCHANGED: DeepUpdateRequest = {
  hasChildren: null,
  showChildren: null,
  wantsChildren: null,
  partnerChildren: null,
  smoking: null,
  drinking: null,
  faith: null,
  lifestyle: null,
};

/** A row's value: the answer, and for children whether it is shown in the Tavern. */
function rowValue(deep: MyDeepView, field: keyof DeepView) {
  const v = deep.answers[field];
  if (!v) return t('deep.unanswered');
  if (field === 'hasChildren' && v === 'yes' && deep.showChildren) return t('deep.hasChildren.yesShown');
  return deepAnswer(field, v);
}

/**
 * The deep profile (Figma 254:6663; the Yard 254:7018). Members fill it; another member reads it after
 * the fourth seal. Whether you have children is everyone's to say, and to show in the Tavern at once.
 * The game is the same for everyone.
 */
export default function DeepProfile() {
  const deep = useGetDeepProfile().data;
  const header = <RoomHeader title={t('room.character')} onBack={router.back} />;
  if (!deep) return <Scene header={header}>{null}</Scene>;
  const rows = DEEP.filter((q) => deep.open || q.open);
  return (
    <Scene
      header={header}
      footer={
        deep.open ? undefined : (
          <Button label={t('seek.restsLink')} onPress={() => router.replace('/guild-house')} block />
        )
      }
    >
      <View style={styles.head}>
        <Txt variant="displayL" engraved accessibilityRole="header">
          {t('deep.title')}
        </Txt>
        <Txt variant="voiceM" color="textSecondary">
          {deep.open ? t('deep.body') : t('deep.bodyYard')}
        </Txt>
      </View>
      <View style={styles.rows}>
        {rows.map((q) => (
          <SettingRow
            key={q.field}
            glyph={q.glyph}
            title={deepTitle(q.field)}
            value={rowValue(deep, q.field)}
            onPress={() => router.push(`/deep/${q.field}` as never)}
          />
        ))}
      </View>
      {deep.open ? null : (
        <View style={styles.sealed}>
          <Banner clasp text={t('deep.sealedRest')} />
        </View>
      )}
    </Scene>
  );
}

/**
 * One question's answers (Figma 35:392); choosing saves and goes back. Whether you have children
 * also carries its switch: show it in the Tavern now, or keep it for the fourth seal (254:6790).
 */
export function DeepPicker() {
  const { field } = useLocalSearchParams<{ field: string }>();
  const q = DEEP.find((d) => d.field === field);
  const deep = useGetDeepProfile().data;
  const current = deep?.answers[q?.field ?? 'hasChildren'];
  const client = useQueryClient();
  if (!q) return null;
  const save = async (change: Partial<DeepUpdateRequest>) => {
    try {
      const saved = await setDeepProfile({ ...UNCHANGED, ...change });
      // The engine's answer is the new truth; profile.updated says the same a moment later.
      client.setQueryData(getGetDeepProfileQueryKey(), saved);
      return true;
    } catch (e) {
      toast('error', e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'));
      return false;
    }
  };
  const pick = async (value: string) => {
    if (await save({ [q.field]: value })) router.back();
  };
  return (
    <Scene header={<RoomHeader title={t('room.character')} onBack={router.back} />}>
      <Txt variant="displayL" engraved accessibilityRole="header" style={styles.pickTitle}>
        {deepTitle(q.field)}
      </Txt>
      <View style={styles.rows}>
        {q.choices.map((c) => (
          <PickRow key={c} label={deepPick(q.field, c)} selected={current === c} onPress={() => pick(c)} />
        ))}
      </View>
      {q.field === 'hasChildren' ? (
        <View style={[styles.rows, styles.show]}>
          <SettingRow
            glyph="eye"
            title={t('deep.showChildren')}
            subtitle={t('deep.showChildrenHint')}
            control={
              <Toggle
                label={t('deep.showChildren')}
                value={current === 'yes' && !!deep?.showChildren}
                disabled={current !== 'yes'}
                onChange={(v) => save({ showChildren: v })}
              />
            }
          />
        </View>
      ) : null}
    </Scene>
  );
}

const styles = StyleSheet.create({
  sealed: { marginTop: dimension.space4 },
  show: { marginTop: dimension.space5 },
  head: { gap: dimension.space2, paddingTop: dimension.space2, marginBottom: dimension.space3 },
  rows: { marginHorizontal: -dimension.sizeGutter },
  pickTitle: { paddingTop: dimension.space2, marginBottom: dimension.space3 },
});
