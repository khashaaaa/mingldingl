import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SectionLabel } from '@/design/components/Banner';
import { Cascade } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Row } from '@/design/components/Row';
import { StateBlock } from '@/design/components/StateBlock';
import { StatLine } from '@/design/components/StatLine';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { useGetEncounterLog, useGetSeason } from '@/lib/api/generated/engine';
import type { EncounterLogRow, SeasonView, StandingView } from '@/lib/api/generated/model';
import { getLocale, type StringKey, t, tCount, tLine, tPlace } from '@/lib/i18n';
import { Scene } from '../common/Scene';

const CARTOGRAPHER = 3;
const HONOURED = ['tsagaanSar', 'naadam'];

/** Encounter Log (Figma 28:840): your word, scars and waypoints, the season's honour, every encounter. */
export default function EncounterLog() {
  const log = useGetEncounterLog().data;
  const season = useGetSeason().data;
  const header = <RoomHeader title={t('room.encounterLog')} onBack={() => router.back()} />;
  if (!log) return <Scene header={header}>{null}</Scene>;
  return (
    <Scene header={header}>
      <View style={styles.page}>
        <View style={styles.standing}>
          <Txt variant="displayM" accessibilityRole="header">
            {t('log.standing')}
          </Txt>
          <Standing s={log.standing} season={season} />
        </View>
        <SectionLabel text={t('log.encounters')} />
        {log.encounters.length === 0 ? (
          <View style={styles.empty}>
            <StateBlock kind="empty" title={t('log.emptyTitle')} body={t('log.emptyBody')} />
          </View>
        ) : (
          <Cascade>
            {log.encounters.map((e) => (
              <Row
                key={e.meetingId}
                title={t('log.row', { name: e.name, venue: e.venue })}
                subtitle={outcome(e)}
                meta={new Date(e.at)
                  .toLocaleDateString(getLocale() === 'mn' ? 'mn-MN' : 'en-GB', {
                    day: 'numeric',
                    month: 'short',
                  })
                  .toUpperCase()}
              />
            ))}
          </Cascade>
        )}
      </View>
    </Scene>
  );
}

function Standing({ s, season }: { s: StandingView; season?: SeasonView }) {
  const charted = s.districts.length;
  const fest = season?.now && HONOURED.includes(season.now.key) ? season.now : season?.nextHonour;
  return (
    <>
      <StatLine
        label={t('log.word')}
        value={s.counted > 0 ? t('log.wordValue', { kept: s.kept, counted: s.counted }) : t('log.wordNone')}
      />
      <StatLine
        label={t('log.scars')}
        value={s.openScars > 0 ? tCount('log.scarsOpen', s.openScars) : t('log.scarsNone')}
      />
      <StatLine
        label={t('log.waypoints')}
        value={
          charted === 0
            ? t('log.waypointsNone')
            : charted >= CARTOGRAPHER
              ? t('log.waypointsCarto', { count: charted })
              : t('log.waypointsValue', { count: charted })
        }
      />
      <StatLine
        label={t('log.season')}
        value={
          fest
            ? tLine('log.seasonHonour', { festival: `festival.${fest.key}` as StringKey })
            : t('log.seasonNone')
        }
      />
    </>
  );
}

function outcome(e: EncounterLogRow): string {
  switch (e.outcome) {
    case 'kept':
      return e.charted ? t('log.keptCharted', { district: tPlace(e.charted) }) : t('log.kept');
    case 'noShow':
      return t('log.noShow');
    case 'missed':
      return t('log.missed');
    case 'disputed':
      return t('log.disputed');
    case 'excused':
      return t('log.excused');
    default:
      return t('log.unanswered');
  }
}

const styles = StyleSheet.create({
  // Rows run edge to edge, past the Scene's gutter.
  page: { marginHorizontal: -dimension.sizeGutter },
  standing: { paddingHorizontal: dimension.sizeGutter, paddingTop: dimension.space1 },
  empty: { paddingTop: dimension.space6, paddingHorizontal: dimension.sizeGutter },
});
