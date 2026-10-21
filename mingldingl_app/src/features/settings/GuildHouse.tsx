import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { SectionLabel } from '@/design/components/Banner';
import { Button } from '@/design/components/Button';
import { Chip } from '@/design/components/Chip';
import { ChoiceCard } from '@/design/components/ChoiceCard';
import { InkLink } from '@/design/components/InkLink';
import { RoomHeader } from '@/design/components/RoomHeader';
import { StateBlock } from '@/design/components/StateBlock';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { useGetMe, useGetMembership } from '@/lib/api/generated/engine';
import type { FloorOffer, MembershipView } from '@/lib/api/generated/model';
import { feedback } from '@/lib/feedback';
import { getLocale, t, tCount } from '@/lib/i18n';
import { hasLegalPages, manageStore, onApple, openLegal } from '@/lib/links';
import {
  buy,
  type Months,
  type PaidFloor,
  productId,
  storeOpen,
  storePrices,
  storeSignIn,
} from '@/lib/store';
import { Scene } from '../common/Scene';
import { moonLine } from '../common/time';

/** 10,900₮ — the engine's price, the way the Guild House writes it. */
export const tugrik = (n: number) => `${n.toLocaleString(getLocale() === 'mn' ? 'mn-MN' : 'en-US')}₮`;

/** "the 5th of the first moon" */
const onMoon = (iso: string) => moonLine('guild.onMoon', iso);

const FLOOR_TITLE = { hall: 'guild.hall', highTable: 'guild.highTable' } as const;

/** What the screen shows. "paying" sits between the store sheet and the engine's word. */
export type GuildStage = 'sealed' | 'choose' | 'paying' | 'welcome' | 'member' | 'failed';

/** Pure: which face of the Guild House a membership and a purchase in flight call for. */
export function guildStage(
  m: MembershipView | undefined,
  open: boolean,
  flight: 'idle' | 'paying' | 'bought' | 'failed',
) {
  if (!m?.open || !open) return 'sealed' as const;
  if (flight === 'failed') return 'failed' as const;
  if (flight === 'paying') return 'paying' as const;
  if (m.floor === 'yard') return flight === 'bought' ? ('paying' as const) : ('choose' as const);
  return flight === 'bought' ? ('welcome' as const) : ('member' as const);
}

/**
 * The Guild House (Figma 35:754, paying 35:853, welcome 35:919, sealed 35:989, your floor and
 * "did not land" 216:4728–4900). Buying goes through the store; the floor itself is only ever the
 * engine's word, which arrives live (membership.updated).
 */
export default function GuildHouse() {
  const me = useGetMe().data;
  const data = useGetMembership().data;
  const m = data?.membership;
  const [floor, setFloor] = useState<PaidFloor>('hall');
  const [months, setMonths] = useState<Months>(3);
  const [flight, setFlight] = useState<'idle' | 'paying' | 'bought' | 'failed'>('idle');
  const [prices, setPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!me) return;
    storeSignIn(me.accountId)
      .then(storePrices)
      .then(setPrices, () => {});
  }, [me]);

  const stage = guildStage(m, storeOpen(), flight);
  const offer = (f: PaidFloor, n: Months): FloorOffer | undefined =>
    data?.offers.find((o) => o.floor === f && o.months === n);
  const price = (f: PaidFloor, n: Months) => prices[productId(f, n)] ?? tugrik(offer(f, n)?.amount ?? 0);

  const climb = async (f: PaidFloor = floor, n: Months = months) => {
    setFloor(f);
    setFlight('paying');
    try {
      const r = await buy(f, n);
      if (r === 'cancelled') return setFlight('idle');
      feedback('rewardBurst');
      setFlight('bought');
    } catch {
      setFlight('failed');
    }
  };

  const header = <RoomHeader title={t('guild.title')} onBack={router.back} sign />;

  if (stage === 'sealed' || stage === 'failed' || stage === 'paying') {
    const failed = stage === 'failed';
    return (
      <Scene
        header={header}
        footer={
          stage === 'paying' ? undefined : (
            <InkLink
              label={failed ? t('guild.tryAgain') : t('common.back')}
              onPress={failed ? () => setFlight('idle') : router.back}
            />
          )
        }
      >
        {stage === 'paying' ? (
          <View style={styles.waiting}>
            <StateBlock
              kind="waiting"
              title={t('guild.payingTitle')}
              body={t('guild.payingBody', { floor: t(FLOOR_TITLE[floor]) })}
            />
          </View>
        ) : (
          <View style={styles.body}>
            <Art name="guild_seal" style={styles.art} />
            <Txt variant="displayL" engraved align="center" accessibilityRole="header">
              {failed ? t('guild.failedTitle') : t('guild.sealedTitle')}
            </Txt>
            <Txt variant="voiceM" color="textSecondary" align="center">
              {failed ? t('guild.failedBody') : t('guild.sealedBody')}
            </Txt>
          </View>
        )}
      </Scene>
    );
  }

  if ((stage === 'welcome' || stage === 'member') && m) {
    const on = m.floor === 'highTable' ? 'highTable' : 'hall';
    const welcome = stage === 'welcome';
    const until = m.until ? onMoon(m.until) : '';
    const line = m.renews
      ? t('guild.renewsOn', { date: until })
      : m.source === 'keeper'
        ? t('guild.giftUntil', { date: until })
        : t('guild.paidUntil', { date: until });
    return (
      <Scene
        header={header}
        footer={
          <View style={styles.footer}>
            {welcome ? (
              <Button label={t('guild.fillDeep')} onPress={() => router.replace('/character-edit')} block />
            ) : on === 'hall' ? (
              <Button label={t('guild.climbHigh')} onPress={() => climb('highTable', 1)} block />
            ) : null}
            {!welcome && m.source === 'store' ? (
              <InkLink
                label={t(onApple ? 'guild.manageAppStore' : 'guild.manageStore')}
                onPress={manageStore}
              />
            ) : (
              <InkLink label={t('guild.backToWarRoom')} onPress={() => router.dismissTo('/war-room')} />
            )}
          </View>
        }
      >
        <View style={styles.body}>
          <Art name="honour_locked" style={styles.art} />
          <Txt variant="displayL" engraved align="center" accessibilityRole="header">
            {welcome
              ? t('guild.welcome', { floor: t(FLOOR_TITLE[on]) })
              : t('guild.youSit', { floor: t(FLOOR_TITLE[on]) })}
          </Txt>
          <Txt variant="voiceM" color="textSecondary" align="center">
            {t(on === 'highTable' ? 'guild.highTableGives' : 'guild.hallGives')}
          </Txt>
          <Txt variant="labelS" color="textMuted" align="center">
            {(m.source === 'store'
              ? `${t(onApple ? 'guild.throughAppStore' : 'guild.throughStore')} · ${line}`
              : line
            ).toUpperCase()}
          </Txt>
        </View>
      </Scene>
    );
  }

  return (
    <Scene
      header={header}
      footer={
        <Button
          label={t('guild.climb', { floor: t(FLOOR_TITLE[floor]), price: price(floor, months) })}
          onPress={() => climb()}
          block
        />
      }
    >
      <View style={styles.choose}>
        <Txt variant="displayL" engraved accessibilityRole="header">
          {t('guild.climbTitle')}
        </Txt>
        <Txt variant="voiceM" color="textSecondary">
          {t('guild.climbBody')}
        </Txt>
        <View accessibilityRole="radiogroup" style={styles.cards}>
          <ChoiceCard
            glyph="post"
            title={t('guild.yardCard')}
            body={t('guild.yardGives')}
            selected={false}
            onPress={() => {}}
          />
          {(['hall', 'highTable'] as const).map((f) => (
            <ChoiceCard
              key={f}
              glyph={f === 'hall' ? 'feast' : 'crown'}
              title={`${t(FLOOR_TITLE[f])} · ${price(f, 1)}`}
              body={t(f === 'hall' ? 'guild.hallGives' : 'guild.highTableGives')}
              selected={floor === f}
              onPress={() => setFloor(f)}
            />
          ))}
        </View>
        <SectionLabel text={t('guild.howLong')} />
        <View accessibilityRole="radiogroup" style={styles.chips}>
          {([1, 3, 6] as const).map((n) => {
            const o = offer(floor, n);
            const off = o?.discountPercent ? ` · −${o.discountPercent}%` : '';
            return (
              <Chip
                key={n}
                label={`${tCount('guild.moons', n)} · ${price(floor, n)}${off}`}
                lit={months === n}
                onPress={() => setMonths(n)}
              />
            );
          })}
        </View>
        {/* What the stores ask a subscription screen to say: it renews, where to cancel, the terms. */}
        <Txt variant="bodyS" color="textMuted">
          {t(onApple ? 'guild.renewsAppStore' : 'guild.renewsPlay')}
        </Txt>
        {hasLegalPages ? (
          <View style={styles.legal}>
            <InkLink label={t('legal.termsShort')} onPress={() => openLegal('terms')} />
            <InkLink label={t('legal.privacyShort')} onPress={() => openLegal('privacy')} />
          </View>
        ) : null}
      </View>
    </Scene>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: 'center', gap: 14, paddingTop: 94, paddingHorizontal: 5 },
  waiting: { paddingTop: 94 },
  art: { width: 140, height: 140 },
  choose: { gap: dimension.space2, paddingTop: dimension.space2 },
  cards: { gap: dimension.space2, marginVertical: dimension.space2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  legal: { flexDirection: 'row', justifyContent: 'center', gap: dimension.space4 },
  footer: { gap: dimension.space3, alignItems: 'stretch', alignSelf: 'stretch' },
});
