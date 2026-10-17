import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SectionLabel } from '@/design/components/Banner';
import { Button } from '@/design/components/Button';
import { Chip } from '@/design/components/Chip';
import { InkLink } from '@/design/components/InkLink';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import { setSeekFilters, useGetCities, useGetMe, useGetSeekFilters } from '@/lib/api/generated/engine';
import type { SeekFilterRequest } from '@/lib/api/generated/model';
import { tPlace as placeName, type StringKey, t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';

/** The age bands the chips offer; "any" is no bound. */
export const AGES: { key: StringKey; min: number | null; max: number | null }[] = [
  { key: 'filters.ageAny', min: null, max: null },
  { key: 'filters.age18', min: 18, max: 24 },
  { key: 'filters.age25', min: 25, max: 34 },
  { key: 'filters.age35', min: 35, max: 44 },
  { key: 'filters.age45', min: 45, max: null },
];
const OATHS = ['Bond', 'Fate', 'Kinship'] as const;
const CHILDREN = ['has', 'wants', 'doesNotWant'] as const;

const EMPTY: SeekFilterRequest = {
  ageMin: null,
  ageMax: null,
  city: null,
  oath: null,
  children: null,
  smoking: null,
  drinking: null,
};

/**
 * Who the tavern shows (Figma 223:1697), the Hall's: filters only narrow who comes — the order is
 * everyone's order, and nobody is shown first for paying.
 */
export default function SeekFilters() {
  const saved = useGetSeekFilters().data;
  const myCity = useGetMe().data?.profile?.city ?? null;
  const cities = useGetCities().data ?? [];
  const region = cities.find((c) => c.name === myCity)?.region;
  const districts = cities.filter((c) => c.region === region).map((c) => c.name);
  const [f, setF] = useState<SeekFilterRequest>(EMPTY);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (saved) {
      const { open: _open, ...rest } = saved;
      setF({ ...EMPTY, ...rest });
    }
  }, [saved]);

  const set = (patch: Partial<SeekFilterRequest>) => setF((x) => ({ ...x, ...patch }));
  const save = async (next: SeekFilterRequest) => {
    setBusy(true);
    try {
      await setSeekFilters(next);
      router.back();
    } catch (e) {
      toast('error', e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Scene
      header={<RoomHeader title={t('room.tavern')} onBack={router.back} />}
      footer={
        <View style={styles.footer}>
          <Button label={t('filters.show')} onPress={() => save(f)} loading={busy} block />
          <InkLink label={t('filters.clear')} onPress={() => save(EMPTY)} disabled={busy} />
        </View>
      }
    >
      <View style={styles.head}>
        <Txt variant="displayL" engraved accessibilityRole="header">
          {t('filters.title')}
        </Txt>
        <Txt variant="voiceM" color="textSecondary">
          {t('filters.body')}
        </Txt>
      </View>

      <SectionLabel flush text={t('filters.age')} />
      <View accessibilityRole="radiogroup" style={styles.chips}>
        {AGES.map((a) => (
          <Chip
            key={a.key}
            label={t(a.key)}
            lit={f.ageMin === a.min && f.ageMax === a.max}
            onPress={() => set({ ageMin: a.min, ageMax: a.max })}
          />
        ))}
      </View>

      <SectionLabel flush text={t('filters.district')} />
      <View accessibilityRole="radiogroup" style={styles.chips}>
        <Chip label={t('filters.anywhere')} lit={f.city === null} onPress={() => set({ city: null })} />
        {districts.map((d) => (
          <Chip key={d} label={placeName(d)} lit={f.city === d} onPress={() => set({ city: d })} />
        ))}
      </View>

      <SectionLabel flush text={t('filters.oath')} />
      <View accessibilityRole="radiogroup" style={styles.chips}>
        <Chip label={t('filters.any')} lit={f.oath === null} onPress={() => set({ oath: null })} />
        {OATHS.map((o) => (
          <Chip
            key={o}
            label={t(`oath.${o}` as StringKey)}
            lit={f.oath === o}
            onPress={() => set({ oath: o })}
          />
        ))}
      </View>

      <SectionLabel flush text={t('filters.deep')} />
      <View style={styles.chips}>
        {CHILDREN.map((c) => (
          <Chip
            key={c}
            label={t(`filters.children.${c}` as StringKey)}
            lit={f.children === c}
            onPress={() => set({ children: f.children === c ? null : c })}
          />
        ))}
        <Chip
          label={t('filters.noSmoke')}
          lit={f.smoking === 'never'}
          onPress={() => set({ smoking: f.smoking === 'never' ? null : 'never' })}
        />
        <Chip
          label={t('filters.noDrink')}
          lit={f.drinking === 'never'}
          onPress={() => set({ drinking: f.drinking === 'never' ? null : 'never' })}
        />
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  head: { gap: dimension.space2, paddingTop: dimension.space2, marginBottom: dimension.space3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: dimension.space3 },
  footer: { gap: dimension.space3, alignItems: 'stretch', alignSelf: 'stretch' },
});
