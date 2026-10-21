import { router } from 'expo-router';
import { Row } from '@/design/components/Row';
import { useGetCampaign, useGetWeeklyTrial } from '@/lib/api/generated/engine';
import { t } from '@/lib/i18n';

/** The bond's Campaign in its options sheet (one row; the week's trial and retiring live on the Campaign). */
export function CampaignRow({ bondId, go }: { bondId: string; go: (to: string) => void }) {
  const c = useGetCampaign(bondId).data;
  return (
    <Row
      glyph="road"
      title={t('bond.optCampaign')}
      subtitle={t('bond.optCampaignHint', { n: c?.cleared ?? 0 })}
      onPress={() => go(`/campaign/${bondId}`)}
    />
  );
}

/** Under the Campaign's map: this week's trial, and retiring together once it is open. */
export function RoadRows({ bondId, name }: { bondId: string; name: string }) {
  const c = useGetCampaign(bondId).data;
  const weekly = useGetWeeklyTrial(bondId).data;
  return (
    <>
      {weekly ? (
        <Row
          glyph="pennant"
          title={t('bond.optWeekly')}
          subtitle={t('bond.optWeeklyHint')}
          onPress={() => router.push(`/weekly/${bondId}`)}
        />
      ) : null}
      {c && c.retire !== 'none' ? (
        <Row
          glyph="chair"
          title={t('bond.optRetire')}
          subtitle={
            c.retire === 'askedByThem'
              ? t('bond.optRetireAsked', { name })
              : c.retire === 'askedByMe'
                ? t('bond.optRetireMine', { name })
                : t('bond.optRetireHint')
          }
          onPress={() => router.push(`/retire/${bondId}`)}
        />
      ) : null}
    </>
  );
}
