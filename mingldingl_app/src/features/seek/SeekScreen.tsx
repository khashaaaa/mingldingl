import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Banner } from '@/design/components/Banner';
import { Button } from '@/design/components/Button';
import { CandleRow } from '@/design/components/CandleRow';
import { asTier } from '@/design/components/GemBadge';
import { InkLink } from '@/design/components/InkLink';
import { RoomHeader } from '@/design/components/RoomHeader';
import { Row } from '@/design/components/Row';
import { SeekCard } from '@/design/components/SeekCard';
import { Sheet } from '@/design/components/Sheet';
import { StateBlock } from '@/design/components/StateBlock';
import { dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import { pass, secondLook, summon, useGetSeason, useGetSeek } from '@/lib/api/generated/engine';
import type { SeekView } from '@/lib/api/generated/model';
import { type StringKey, t, tCount, tError } from '@/lib/i18n';
import en from '@/lib/i18n/en.json';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { until, useMinute } from '../common/time';
import { Ornament } from '../square/festivals';
import { toHearth } from '../world/home';

/**
 * The Tavern (Figma 26:3 and its three empty states): one companion at a time. Summon makes the
 * bond at once and opens its ceremony; pass hides them until tomorrow. `seek.changed` redraws it.
 */
/** Candles are counted out only when few are left; a long row of them is just "to spare". */
export const candleLine = (left: number) =>
  left > 0 && left <= 5 ? tCount('seek.candlesFew', left) : t('seek.candlesMany');

export default function SeekScreen() {
  const seek = useGetSeek().data;
  const [menu, setMenu] = useState(false);
  const festival = useGetSeason().data?.now?.key;
  // Figma 47:1206: a festival with an honour says so above the companion, its ornament across the sky.
  const banner =
    festival && `festival.seekBanner.${festival}` in en
      ? (`festival.seekBanner.${festival}` as StringKey)
      : null;
  return (
    <View style={styles.fill}>
      <Ornament festival={festival} />
      <Scene
        header={
          <RoomHeader
            title={t('room.tavern')}
            onHome={toHearth}
            action={{ glyph: 'more', label: t('seek.menu'), onPress: () => setMenu(true) }}
          />
        }
        centered={seek?.state !== 'companion'}
        tabbed
      >
        {banner ? <Banner glyph="lantern" tint="accentGoldBright" text={t(banner)} /> : null}
        {seek ? <Body seek={seek} /> : null}
      </Scene>
      {seek ? <TavernMenu seek={seek} open={menu} onClose={() => setMenu(false)} /> : null}
    </View>
  );
}

/**
 * The tavern's ⋮ (Figma 223:1613, the Yard's 223:1655): who the tavern shows and tonight's second
 * look — the Hall's; on the Yard each row leads to the Guild House.
 */
function TavernMenu({ seek, open, onClose }: { seek: SeekView; open: boolean; onClose: () => void }) {
  const member = seek.floor !== 'yard';
  const go = (to: string) => {
    onClose();
    router.push(to as never);
  };
  const look = async () => {
    onClose();
    try {
      await secondLook();
    } catch (e) {
      toast('error', e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'));
    }
  };
  return (
    <Sheet kind="menu" open={open} title={t('seek.menuTitle')} onClose={onClose}>
      <View style={styles.menu}>
        <Row
          glyph="eye"
          title={t('seek.filters')}
          subtitle={member ? t(seek.filtered ? 'seek.filtersOn' : 'seek.filtersOff') : t('seek.hallOnly')}
          onPress={() => go(member ? '/seek-filters' : '/guild-house')}
        />
        <Row
          glyph="turn"
          title={t('seek.secondLook')}
          subtitle={
            !member
              ? t('seek.hallOnly')
              : seek.secondLook
                ? t('seek.secondLookReady')
                : t('seek.secondLookNone')
          }
          onPress={!member ? () => go('/guild-house') : seek.secondLook ? look : undefined}
        />
      </View>
    </Sheet>
  );
}

function Body({ seek }: { seek: SeekView }) {
  const [busy, setBusy] = useState<'summon' | 'pass' | null>(null);
  const now = useMinute();
  const candles = (
    <CandleRow left={seek.candlesLeft} total={seek.candlesPerDay} label={candleLine(seek.candlesLeft)} />
  );

  switch (seek.state) {
    case 'rests':
      return (
        <View style={styles.state}>
          <StateBlock
            kind="empty"
            title={t('seek.restsTitle')}
            body={t('seek.restsBody')}
            action={
              seek.floor === 'highTable'
                ? undefined
                : { label: t('seek.restsLink'), onPress: () => router.push('/guild-house') }
            }
          />
          <CandleRow
            left={0}
            total={seek.candlesPerDay}
            label={t('seek.newCandles', { time: until(seek.nextDawnAt, now) })}
          />
        </View>
      );
    case 'full':
      return (
        <StateBlock
          kind="empty"
          title={t('seek.fullTitle')}
          body={t('seek.fullBody', { count: seek.seats })}
          action={{ label: t('seek.fullLink'), onPress: () => router.navigate('/quests') }}
        />
      );
    case 'closed':
      return <StateBlock kind="waiting" title={t('seek.closedTitle')} body={t('seek.closedBody')} />;
    case 'empty':
      return (
        <View style={styles.state}>
          <StateBlock
            kind="empty"
            title={t('seek.emptyTitle')}
            body={t(seek.filtered ? 'seek.emptyFiltered' : 'seek.emptyBody')}
            action={
              seek.filtered
                ? { label: t('seek.widen'), onPress: () => router.push('/seek-filters') }
                : undefined
            }
          />
          {candles}
        </View>
      );
  }

  const c = seek.candidate;
  if (!c) return null;
  const act = async (kind: 'summon' | 'pass') => {
    setBusy(kind);
    try {
      if (kind === 'summon') {
        const bond = await summon(c.accountId);
        router.push(`/ceremony/bond/${bond.id}`);
      } else {
        await pass(c.accountId);
      }
    } catch (e) {
      toast('error', e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'));
    } finally {
      setBusy(null);
    }
  };
  return (
    <View style={styles.companion}>
      <SeekCard
        name={null}
        age={c.age}
        tier={asTier(c.tier)}
        place={c.place ?? null}
        oath={c.oath ?? null}
        tale={c.bio ?? null}
        portrait={c.portrait ? { id: c.portrait.id, thumbHash: c.portrait.thumbHash } : null}
        hasChildren={c.hasChildren}
        faceProven={c.faceProven}
      />
      <Button
        label={t('seek.summon')}
        onPress={() => act('summon')}
        loading={busy === 'summon'}
        disabled={busy !== null}
      />
      <InkLink label={t('seek.pass')} onPress={() => act('pass')} disabled={busy !== null} />
      {candles}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  companion: { alignItems: 'center', gap: dimension.space4, paddingTop: dimension.space4 },
  state: { alignItems: 'center', gap: dimension.space5 },
  menu: { alignSelf: 'stretch' },
});
