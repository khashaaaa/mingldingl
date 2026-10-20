import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { Glyph } from '@/design/components/Art';
import { SectionLabel } from '@/design/components/Banner';
import { Reveal } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StateBlock } from '@/design/components/StateBlock';
import { Txt } from '@/design/components/Txt';
import type { GlyphName } from '@/design/glyphs';
import { dimension } from '@/design/tokens';
import { getDeeds } from '@/lib/api/generated/engine';
import type { DeedView } from '@/lib/api/generated/model';
import { getLocale, type StringKey, t } from '@/lib/i18n';
import { deedsKey } from '@/lib/live/events';
import { Scene } from '../common/Scene';

const GLYPH: Record<string, GlyphName> = {
  finished: 'forge',
  firstLetter: 'quill',
  reply: 'letters',
  dawn: 'dawn',
  seventhDawn: 'star',
  goneCold: 'frost',
  penalised: 'scales',
};

type Item = { kind: 'day'; key: string; text: string } | { kind: 'deed'; key: string; deed: DeedView };

/** "Today", "Yesterday" or the date, over each day's deeds (days are Ulaanbaatar days). */
function deedItems(deeds: DeedView[], today: string, yesterday: string): Item[] {
  const out: Item[] = [];
  let day = '';
  for (const d of deeds) {
    if (d.day !== day) {
      day = d.day;
      const text =
        day === today
          ? t('bond.today')
          : day === yesterday
            ? t('bond.yesterday')
            : new Date(`${day}T12:00:00`).toLocaleDateString(getLocale() === 'mn' ? 'mn-MN' : 'en-GB', {
                day: 'numeric',
                month: 'long',
              });
      out.push({ kind: 'day', key: `d${day}`, text });
    }
    out.push({ kind: 'deed', key: d.id, deed: d });
  }
  return out;
}

const ubDay = (offsetDays: number) =>
  new Date(Date.now() + 8 * 3_600_000 - offsetDays * 86_400_000).toISOString().slice(0, 10);

/** Chronicle of Deeds (Figma 28:332): every point earned or lost, newest first, by day. */
export default function Chronicle() {
  const q = useInfiniteQuery({
    queryKey: deedsKey,
    queryFn: ({ pageParam }) => getDeeds(pageParam ? { before: pageParam, limit: 30 } : { limit: 30 }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextBefore ?? null,
    maxPages: 10,
  });
  const deeds = q.data?.pages.flatMap((p) => p.items) ?? [];
  const header = <RoomHeader title={t('room.chronicle')} onBack={() => router.back()} />;
  if (q.isSuccess && deeds.length === 0)
    return (
      <Scene header={header} centered>
        <StateBlock kind="empty" title={t('deeds.emptyTitle')} body={t('deeds.emptyBody')} />
      </Scene>
    );
  return (
    <Scene header={header} bare>
      <FlatList
        data={deedItems(deeds, ubDay(0), ubDay(1))}
        keyExtractor={(i) => i.key}
        onEndReached={q.hasNextPage ? () => q.fetchNextPage() : undefined}
        renderItem={({ item, index }) => (
          // The first screenful bleeds in line after line; rows reached by scrolling simply arrive.
          <Reveal order={index < 8 ? index : 0} rise={6}>
            {item.kind === 'day' ? (
              <SectionLabel text={item.text} />
            ) : (
              <View style={styles.row} accessible>
                <Glyph name={GLYPH[item.deed.kind] ?? 'spark'} size={20} tint="accentGold" />
                <Txt variant="voiceM" style={styles.text}>
                  {t(`deed.${item.deed.kind}` as StringKey)}
                </Txt>
                <Txt variant="numberS" color={item.deed.amount < 0 ? 'textDanger' : 'textAccent'}>
                  {item.deed.amount > 0 ? `+${item.deed.amount}` : `−${-item.deed.amount}`}
                </Txt>
              </View>
            )}
          </Reveal>
        )}
      />
    </Scene>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: dimension.space3,
    paddingHorizontal: dimension.sizeGutter,
    paddingVertical: dimension.space3,
  },
  text: { flex: 1 },
});
