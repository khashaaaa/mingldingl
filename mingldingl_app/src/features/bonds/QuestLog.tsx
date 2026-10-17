import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Banner, SectionLabel } from '@/design/components/Banner';
import { BondRow } from '@/design/components/BondRow';
import { Cascade } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StateBlock } from '@/design/components/StateBlock';
import { dimension } from '@/design/tokens';
import { useGetBonds, useGetThreadInvitations } from '@/lib/api/generated/engine';
import type { BondRow as Row } from '@/lib/api/generated/model';
import { type StringKey, t } from '@/lib/i18n';
import { Scene } from '../common/Scene';
import { ago, hoursBetween, useMinute } from '../common/time';
import { toHearth } from '../world/home';
import { RoadNotice } from './RoadNotice';

const CLOSED_SHOWN = 10;

/** One bond's preview line: the last letter, or what became of it. */
export function lineOf(b: Row): string {
  if (b.state === 'Cold') return t('quests.wentCold');
  if (b.state === 'Severed') return t('quests.severed');
  if (b.state === 'Faded') return t('quests.faded');
  if (b.state === 'Retired') return t('quests.retired');
  if (!b.lastLetter) return t('quests.noWords');
  return b.lastLetterMine
    ? t('quests.you', { text: b.lastLetter })
    : t('quests.quote', { text: b.lastLetter });
}

/**
 * The Quest Log (Figma 26:322): bonds whose turn is yours, bonds waiting on them, and the ones gone
 * cold. The most urgent embers stand at the top. Live: `bond.*` and `letter.created` redraw it.
 */
export default function QuestLog() {
  const bonds = useGetBonds().data;
  const threads = useGetThreadInvitations().data ?? [];
  const now = useMinute();
  if (!bonds)
    return (
      <Scene header={<RoomHeader title={t('room.questLog')} onBack={toHearth} />} tabbed>
        {null}
      </Scene>
    );

  const live = bonds.filter((b) => b.state === 'Live');
  const mine = live.filter((b) => b.myTurn || !b.lastLetterAt);
  const theirs = live.filter((b) => !b.myTurn && b.lastLetterAt);
  const closed = bonds.filter((b) => b.state !== 'Live').slice(0, CLOSED_SHOWN);
  const urgent = mine
    .filter((b) => b.embers && b.coldAt)
    .sort((a, b) => Date.parse(a.coldAt ?? '') - Date.parse(b.coldAt ?? ''))[0];

  if (bonds.length === 0 && threads.length === 0)
    return (
      <Scene header={<RoomHeader title={t('room.questLog')} onBack={toHearth} />} centered tabbed>
        <StateBlock
          kind="empty"
          title={t('quests.emptyTitle')}
          body={t('quests.emptyBody')}
          action={{ label: t('quests.emptyLink'), onPress: () => router.navigate('/seek') }}
        />
      </Scene>
    );

  const section = (label: StringKey, rows: Row[]) =>
    rows.length === 0 ? null : (
      <View>
        <SectionLabel text={t(label)} />
        <Cascade>
          {rows.map((b) => (
            <BondRow
              key={b.id}
              name={b.otherName}
              line={lineOf(b)}
              ago={ago(b.closedAt ?? b.lastLetterAt ?? b.createdAt, now)}
              portrait={
                b.otherPortrait
                  ? { id: b.otherPortrait.id, url: b.otherPortrait.url, thumbHash: b.otherPortrait.thumbHash }
                  : null
              }
              sealed={b.seals < 1}
              unread={b.unread}
              faded={b.state !== 'Live'}
              onPress={() => router.push(`/bond/${b.id}`)}
            />
          ))}
        </Cascade>
      </View>
    );

  return (
    <Scene header={<RoomHeader title={t('room.questLog')} onBack={toHearth} />} tabbed>
      <RoadNotice />
      {urgent?.coldAt ? (
        <Banner
          text={t('quests.embersBanner', { name: urgent.otherName, hours: hoursBetween(now, urgent.coldAt) })}
        />
      ) : null}
      <View style={styles.list}>
        {section('quests.yourTurn', mine)}
        {section('quests.waiting', theirs)}
        {section('quests.cold', closed)}
        {threads.length > 0 ? (
          <View>
            <SectionLabel text={t('quests.threads')} />
            {threads.map((th) => (
              <BondRow
                key={th.id}
                name={t('quests.threadFrom', { name: th.weaver })}
                line={t(th.myAnswer ? 'quests.threadYours' : 'quests.threadWaiting', { name: th.weaver })}
                ago={ago(th.wovenAt, now)}
                portrait={null}
                sealed={false}
                unread={th.myAnswer === null}
                emblem="honour_thread_weaver"
                onPress={() => router.push(`/thread/${th.id}`)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  // Rows run edge to edge, past the Scene's gutter.
  list: { marginHorizontal: -dimension.sizeGutter, marginTop: -dimension.space3 },
});
