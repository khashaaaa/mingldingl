import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Button } from '@/design/components/Button';
import { Cascade } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Row } from '@/design/components/Row';
import { StateBlock } from '@/design/components/StateBlock';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { useGetWovenThreads } from '@/lib/api/generated/engine';
import type { WovenRow } from '@/lib/api/generated/model';
import { t } from '@/lib/i18n';
import { Scene } from '../common/Scene';

const GLYPH = { sparked: 'spark', oneSaidYes: 'thread', waiting: 'thread', cut: 'thread-cut' } as const;

const LINE = {
  sparked: 'threads.sparked',
  oneSaidYes: 'threads.oneSaidYes',
  waiting: 'threads.waiting',
  cut: 'threads.cut',
} as const;

/** Thread Log (Figma 28:937): every thread you wove and how it stands — never who the friend was. */
export default function ThreadLog() {
  const rows = useGetWovenThreads().data;
  const weave = <Button label={t('threads.weaveNew')} onPress={() => router.push('/weave')} block />;
  const header = <RoomHeader title={t('room.threadLog')} onBack={() => router.back()} />;
  if (rows && rows.length === 0)
    return (
      <Scene header={header} centered footer={weave}>
        <StateBlock kind="empty" title={t('threads.emptyTitle')} body={t('threads.emptyBody')} />
      </Scene>
    );
  return (
    <Scene header={header} footer={weave}>
      <Txt variant="voiceM" color="textSecondary">
        {t('threads.intro')}
      </Txt>
      <View style={styles.rows}>
        <Cascade>
          {(rows ?? []).map((r) => (
            <Thread key={r.id} r={r} />
          ))}
        </Cascade>
      </View>
    </Scene>
  );
}

function Thread({ r }: { r: WovenRow }) {
  const state = r.state as keyof typeof LINE;
  return (
    <View style={state === 'cut' ? styles.cut : undefined}>
      <Row
        glyph={GLYPH[state] ?? 'thread'}
        title={t('threads.row', { name: r.first })}
        subtitle={t(LINE[state] ?? 'threads.waiting')}
        meta={
          state === 'sparked'
            ? `+${r.points}`
            : state === 'cut'
              ? undefined
              : t('threads.metaWaiting').toUpperCase()
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // Rows run edge to edge, past the Scene's gutter.
  rows: { marginHorizontal: -dimension.sizeGutter },
  cut: { opacity: 0.6 },
});
