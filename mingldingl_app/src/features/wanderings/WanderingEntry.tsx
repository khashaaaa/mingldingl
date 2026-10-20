import { router } from 'expo-router';
import { NextAction } from '@/design/components/NextAction';
import { useGetWanderings } from '@/lib/api/generated/engine';
import { t } from '@/lib/i18n';

/** Under the Campaign's map (Figma 260:2809): the way to the Wanderings, and how many were taken. */
export function WanderingEntry({ bondId }: { bondId: string }) {
  const w = useGetWanderings(bondId).data;
  if (!w) return null;
  return (
    <NextAction
      glyph="map"
      title={t('wander.entryTitle')}
      body={w.firstOpen ? t('wander.entryBody', { n: w.taken, of: w.items.length }) : t('wander.entrySealed')}
      onPress={() => router.push(`/wanderings/${bondId}` as never)}
    />
  );
}

/** In the bond's letters: a Wandering the other asked for, waiting on your answer. */
export function WanderingAsk({ bondId, name }: { bondId: string; name: string }) {
  const asked = useGetWanderings(bondId).data?.items.find((i) => i.state === 'askedOfMe');
  if (!asked) return null;
  return (
    <NextAction
      glyph="map"
      title={t('wander.askedTitle', { name })}
      body={asked.title}
      onPress={() => router.push(`/wanderings/${bondId}/${asked.key}` as never)}
    />
  );
}
