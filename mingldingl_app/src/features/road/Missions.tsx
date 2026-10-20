import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Banner, SectionLabel } from '@/design/components/Banner';
import { DawnStreak } from '@/design/components/DawnStreak';
import { QuestTile } from '@/design/components/QuestTile';
import { Cascade } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import { claimQuest, useGetQuests } from '@/lib/api/generated/engine';
import type { QuestView } from '@/lib/api/generated/model';
import { t, tCount, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { moonLine } from '../common/time';
import { toHearth } from '../world/home';
import { QUEST } from './quests';

/** Missions (Figma 26:570): the seven dawns, today's three quests and the week's one, live. */
/** A ger rest is worth a word for a week after it kept a dawn. */
const keptLately = (keptOn: string | null | undefined, today: string) =>
  keptOn != null && Date.parse(today) - Date.parse(keptOn) <= 7 * 86_400_000;

export default function Missions() {
  const board = useGetQuests().data;
  const [claiming, setClaiming] = useState<string | null>(null);
  const claim = async (q: QuestView) => {
    if (claiming) return;
    setClaiming(q.kind);
    try {
      // The reward toast comes with the score event (WorldWatch), like every other deed.
      const r = await claimQuest(q.kind);
      if (r.chest) router.push(`/ceremony/chest/${r.chest.id}`);
    } catch (e) {
      toast('error', e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'));
    } finally {
      setClaiming(null);
    }
  };
  return (
    <Scene tabbed header={<RoomHeader title={t('room.missions')} onBack={toHearth} />}>
      {board ? (
        <>
          <DawnStreak
            lit={board.lit}
            of={board.streakCap}
            line={board.dawns > 0 ? tCount('missions.dawns', board.dawns) : t('missions.dawnsNone')}
          />
          {keptLately(board.gerRests.keptOn, board.day) ? (
            // Figma 223:1892: a member's ger rest kept the streak over a missed dawn.
            <Banner
              glyph="moon"
              tint="textSecondary"
              text={moonLine('missions.gerRestKept', `${board.gerRests.keptOn}T12:00:00`, {
                left: board.gerRests.left,
                of: board.gerRests.perMoon,
              })}
            />
          ) : null}
          <View style={styles.section}>
            <SectionLabel text={t('missions.today')} />
            <View style={styles.list}>
              <Cascade>
                {board.daily.map((q) => (
                  <Quest key={q.kind} q={q} onClaim={() => claim(q)} />
                ))}
              </Cascade>
            </View>
          </View>
          <View style={styles.section}>
            <SectionLabel text={t('missions.week')} />
            <View style={styles.list}>
              <Cascade delay={board.daily.length * 90}>
                {board.weekly.map((q) => (
                  <Quest key={q.kind} q={q} onClaim={() => claim(q)} />
                ))}
              </Cascade>
            </View>
          </View>
        </>
      ) : null}
    </Scene>
  );
}

function Quest({ q, onClaim }: { q: QuestView; onClaim: () => void }) {
  const look = QUEST[q.kind];
  const state = q.claimed ? 'done' : q.done ? 'claimable' : 'active';
  return (
    <QuestTile
      glyph={look?.glyph ?? 'scroll'}
      title={look ? t(look.title) : q.kind}
      progress={q.progress / q.target}
      progressText={
        q.claimed
          ? t('quest.claimed')
          : q.done
            ? t('quest.claim')
            : t('quest.progress', { n: q.progress, target: q.target })
      }
      reward={`+${q.points}`}
      state={state}
      onClaim={onClaim}
    />
  );
}

const styles = StyleSheet.create({
  // The section label runs edge to edge (its own gutter); the tiles keep the Scene's.
  section: { marginHorizontal: -dimension.sizeGutter },
  list: { gap: 14, paddingHorizontal: dimension.sizeGutter },
});
