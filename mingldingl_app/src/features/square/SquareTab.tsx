import { useQueryClient } from '@tanstack/react-query';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Banner } from '@/design/components/Banner';
import { Button } from '@/design/components/Button';
import { InkLink } from '@/design/components/InkLink';
import { RoomHeader } from '@/design/components/RoomHeader';
import { SealStamp } from '@/design/components/SealStamp';
import { StateBlock } from '@/design/components/StateBlock';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { type Sky, setSkyOverride } from '@/design/world/rooms';
import { ApiError } from '@/lib/api/client';
import {
  getGetSquareQueryKey,
  giveUpSeat,
  takeSeat,
  useGetMembership,
  useGetSquare,
} from '@/lib/api/generated/engine';
import type { GatheringView } from '@/lib/api/generated/model';
import { feedback } from '@/lib/feedback';
import { t, tError } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { clock } from '../common/time';
import { toHearth } from '../world/home';
import { BellCard, dayName } from './BellCard';
import { FESTIVAL, Ornament } from './festivals';

/**
 * The Town Square tab (Figma 26:717 next gathering · 26:820 seat held · 26:929 quiet; festivals
 * 47:479–47:1015). Live: `square.updated` redraws it as seats fill and bells ring.
 */
export default function SquareTab() {
  const client = useQueryClient();
  const square = useGetSquare();
  const g = square.data?.next ?? null;
  const floor = useGetMembership().data?.membership.floor;
  const [busy, setBusy] = useState(false);
  // A festival's bell dresses the sky in its season while the tab is in view (Figma 47:479–47:1015),
  // even before the festival's day; leaving the tab gives the sky back to the calendar.
  const sky = (g?.masked ? null : (g?.festival as Sky | undefined)) ?? null;
  useFocusEffect(useCallback(() => (sky ? setSkyOverride(sky) : undefined), [sky]));
  const header = <RoomHeader title={t('room.square')} onHome={toHearth} />;
  const act = async (call: () => Promise<GatheringView>, stamp = false) => {
    setBusy(true);
    try {
      await call();
      if (stamp) feedback('sealStamp');
      await client.invalidateQueries({ queryKey: getGetSquareQueryKey() });
    } catch (e) {
      toast(
        'error',
        e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('error.generic'),
      );
    } finally {
      setBusy(false);
    }
  };

  // Until the square answers, only the header: "the square is quiet" would be a false word.
  if (!square.data)
    return (
      <Scene header={header} tabbed>
        {null}
      </Scene>
    );

  if (!g)
    return (
      <Scene header={header} centered tabbed>
        <StateBlock
          kind="empty"
          title={t('square.quietTitle')}
          body={t('square.quietBody')}
          action={{ label: t('square.howItWorks'), onPress: () => router.push('/codex') }}
        />
      </Scene>
    );

  const dress = g.festival ? FESTIVAL[g.festival] : undefined;
  const doorsOpen = g.state === 'running' || (g.state === 'open' && Date.now() >= Date.parse(g.doorsAt));
  const when = { day: dayName(g.startsAt), time: clock(g.startsAt) };

  if (g.seated)
    return (
      <View style={styles.fill}>
        <Ornament festival={g.festival} masked={g.masked} />
        <Scene
          header={header}
          tabbed
          footer={
            doorsOpen ? (
              <Button label={t('square.enter')} onPress={() => router.push(`/square/${g.id}`)} block />
            ) : null
          }
        >
          <View style={styles.held}>
            <SealStamp size={64} still />
            <Txt variant="displayL" engraved align="center" accessibilityRole="header">
              {t('square.heldTitle')}
            </Txt>
            <Txt variant="voiceM" color="textSecondary" align="center">
              {g.state === 'running'
                ? t('square.running', { name: g.name })
                : t('square.heldBody', { name: g.name, ...when })}
            </Txt>
            {g.state === 'open' ? <Banner clasp text={t('square.opensOn', when)} /> : null}
            {/* Figma 26:820: giving the seat back sits right under the notice, never at the foot */}
            {g.state === 'open' ? (
              <InkLink label={t('square.giveUp')} onPress={() => act(() => giveUpSeat(g.id))} />
            ) : null}
          </View>
        </Scene>
      </View>
    );

  return (
    <View style={styles.fill}>
      <Ornament festival={g.festival} masked={g.masked} />
      <Scene header={header} tabbed>
        <BellCard g={g} busy={busy} onTake={() => act(() => takeSeat(g.id), true)} />
        {Date.parse(g.seatsOpenAt) > Date.now() && floor !== 'highTable' ? (
          // The High Table's first seat at the bells: everyone else sits a little later.
          <Banner
            glyph="crown"
            tint="accentGoldBright"
            text={t('square.highTableFirst', { time: clock(g.seatsOpenAt) })}
          />
        ) : null}
        <Txt variant="voiceM" color="textSecondary" align={dress ? 'center' : 'left'}>
          {dress ? t(dress.line) : t('square.about')}
        </Txt>
        {dress?.honour ? (
          <Txt variant="labelM" color="textAccent" align="center">
            {t(dress.honour).toUpperCase()}
          </Txt>
        ) : null}
      </Scene>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  held: { alignItems: 'center', gap: dimension.space4, paddingTop: dimension.space7 },
});
