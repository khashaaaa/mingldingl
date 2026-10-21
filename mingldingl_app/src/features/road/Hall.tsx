import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { asTier } from '@/design/components/GemBadge';
import { RankRow } from '@/design/components/RankRow';
import { Cascade } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StateBlock } from '@/design/components/StateBlock';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { useGetHall } from '@/lib/api/generated/engine';
import { getLocale, t, tCount, tPlace } from '@/lib/i18n';
import { Scene } from '../common/Scene';

const n = (v: number) => v.toLocaleString(getLocale() === 'mn' ? 'mn-MN' : 'en-US');

/** Hall of Names (Figma 28:429): your cohort's top five, carved without names, then your torch. */
export default function Hall() {
  const hall = useGetHall().data;
  const header = <RoomHeader title={t('room.hallOfNames')} onBack={() => router.back()} />;
  if (!hall) return <Scene header={header}>{null}</Scene>;
  if (hall.top.length === 0)
    return (
      <Scene header={header} centered>
        <StateBlock kind="empty" title={t('hall.emptyTitle')} body={t('hall.emptyBody')} />
      </Scene>
    );
  const you = hall.you;
  const youInTop = you && you.rank <= hall.top.length;
  return (
    <Scene header={header}>
      <Txt variant="voiceM" color="textSecondary">
        {t('hall.intro', { cohort: tPlace(hall.cohort) })}
      </Txt>
      <View style={styles.rows}>
        <Cascade>
          {hall.top.map((r) =>
            youInTop && r.rank === you.rank && r.points === you.points ? (
              <RankRow
                key={r.rank}
                you
                rank={`#${r.rank}`}
                tier={asTier(r.tier)}
                name={t('hall.you')}
                points={n(r.points)}
              />
            ) : (
              <RankRow
                key={r.rank}
                rank={`#${r.rank}`}
                tier={asTier(r.tier)}
                name={t('hall.sigil')}
                points={n(r.points)}
              />
            ),
          )}
        </Cascade>
        {you && !youInTop ? (
          <>
            <Txt variant="bodyM" color="textSecondary" style={styles.gap}>
              · · ·
            </Txt>
            <RankRow
              you
              rank={`#${you.rank}`}
              tier={asTier(you.tier)}
              name={t('hall.you')}
              points={n(you.points)}
            />
          </>
        ) : null}
      </View>
      {you ? null : (
        <Txt variant="voiceM" color="textSecondary">
          {t('hall.unlisted')}
        </Txt>
      )}
      {hall.retiredPairs > 0 ? (
        <Txt variant="voiceM" color="textSecondary">
          {tCount('hall.retired', hall.retiredPairs)}
        </Txt>
      ) : null}
    </Scene>
  );
}

const styles = StyleSheet.create({
  // Rows run edge to edge, past the Scene's gutter.
  rows: { marginHorizontal: -dimension.sizeGutter },
  gap: { paddingHorizontal: dimension.sizeGutter, paddingVertical: 6 },
});
