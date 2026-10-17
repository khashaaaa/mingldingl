import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { Banner } from '@/design/components/Banner';
import { Composer } from '@/design/components/Composer';
import { Dialog } from '@/design/components/Dialog';
import { Frost } from '@/design/components/Frost';
import { DayHeading, Letter, SealLine } from '@/design/components/Letter';
import { Row } from '@/design/components/Row';
import { Sheet } from '@/design/components/Sheet';
import { StateBlock } from '@/design/components/StateBlock';
import { Txt } from '@/design/components/Txt';
import { dimension } from '@/design/tokens';
import { setFireOverride } from '@/design/world/rooms';
import { ApiError } from '@/lib/api/client';
import { castOut, readBond, severBond, useGetBond, useGetMe } from '@/lib/api/generated/engine';
import type { BondView, LetterView } from '@/lib/api/generated/model';
import { feedback } from '@/lib/feedback';
import { getLocale, t, tError } from '@/lib/i18n';
import { useRoadCut } from '@/lib/live/road';
import { toast } from '@/lib/toast';
import { RetiredTogether } from '../campaign/RetireScreen';
import { CampaignRow } from '../campaign/RoadRows';
import { Scene } from '../common/Scene';
import { clock, dayOf, hoursBetween, useMinute } from '../common/time';
import { NextStep } from '../encounters/NextStep';
import { BondHeader } from './BondHeader';
import { sendLetter, type Unsent, useUnsent } from './outbox';
import { RoadNotice } from './RoadNotice';
import { useLetters } from './useLetters';

const LETTER_MAX = 1000;
const SEALS = 4;

type Item =
  | { kind: 'letter'; key: string; letter: LetterView; time?: string }
  | { kind: 'unsent'; key: string; text: string }
  | { kind: 'seal'; key: string; seal: number }
  | { kind: 'day'; key: string; text: string };

/** Day headings in the person's language: Today, Yesterday, or the date. */
function dayText(iso: string, now: number): string {
  const day = dayOf(iso);
  if (day === dayOf(new Date(now).toISOString())) return t('bond.today');
  if (day === dayOf(new Date(now - 86_400_000).toISOString())) return t('bond.yesterday');
  return new Date(iso).toLocaleDateString(getLocale() === 'mn' ? 'mn-MN' : 'en-GB', {
    day: 'numeric',
    month: 'long',
  });
}

/** A pause this long between letters earns a time under the one before it (Figma 31:97 times a run once). */
const PAUSE_MS = 15 * 60_000;

/**
 * Newest first (the list is inverted): a seal line sits under the letter that broke it, a day
 * heading over its first letter, and a time under the newest letter and wherever the talk paused.
 */
export function itemsOf(letters: LetterView[], now: number, unsent: Unsent[] = []): Item[] {
  // Letters waiting for the road sit below the newest sent one, the last written lowest.
  const out: Item[] = unsent.map((u): Item => ({ kind: 'unsent', key: u.key, text: u.text })).reverse();
  letters.forEach((l, i) => {
    const newer = letters[i - 1];
    const older = letters[i + 1];
    if (l.sealBroken) out.push({ kind: 'seal', key: `s${l.id}`, seal: l.sealBroken });
    out.push({
      kind: 'letter',
      key: l.id,
      letter: l,
      time:
        !newer || Date.parse(newer.createdAt) - Date.parse(l.createdAt) >= PAUSE_MS
          ? clock(l.createdAt)
          : undefined,
    });
    if (!older || dayOf(older.createdAt) !== dayOf(l.createdAt))
      out.push({ kind: 'day', key: `d${l.id}`, text: dayText(l.createdAt, now) });
  });
  return out;
}

/**
 * A bond (Figma 31:3 – 31:492): the letters, the seals breaking, embers when your turn runs out,
 * frost when it has gone cold, the closed page when severed. Everything here redraws from live
 * events; nothing polls.
 */
export default function BondScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bond = useGetBond(id).data;
  const me = useGetMe().data?.profile;
  const { letters, loaded, more } = useLetters(id);
  const unsent = useUnsent(id);
  const road = useRoadCut();
  const now = useMinute();
  const [options, setOptions] = useState(false);
  const [confirm, setConfirm] = useState<'sever' | 'castOut' | 'seals' | null>(null);

  // The fire goes out over a cold bond.
  const cold = bond?.state === 'Cold';
  useEffect(() => (cold ? setFireOverride('Out') : undefined), [cold]);
  // Going cold while you watch is felt as well as seen.
  const wasCold = useRef<boolean | null>(null);
  useEffect(() => {
    if (!bond) return;
    if (wasCold.current === false && cold) feedback('frostCreep');
    wasCold.current = cold;
  }, [bond, cold]);

  // Reading their newest letter clears the unread dot (on every device).
  const newest = letters[0];
  useEffect(() => {
    if (newest && !newest.mine) readBond(id).catch(() => {});
  }, [id, newest]);

  // A seal breaking while the bond is open plays its ceremony.
  const seals = useRef<number | null>(null);
  useEffect(() => {
    if (!bond) return;
    if (seals.current !== null && bond.seals > seals.current) {
      router.push(`/ceremony/seal/${id}`);
    }
    seals.current = bond.seals;
  }, [bond, id]);

  const items = useMemo(() => itemsOf(letters, now, unsent), [letters, now, unsent]);
  if (!bond)
    return (
      <Scene centered>
        {/* Opened with no road: it loads by itself once the road returns (the live reconnect refetches). */}
        {road ? (
          <StateBlock kind="offline" title={t('state.offlineTitle')} body={t('state.offlineBody')} />
        ) : null}
      </Scene>
    );

  const other = bond.other;
  const first = other.portraits[0] ?? null;
  const status =
    bond.state === 'Cold'
      ? t('bond.goneCold')
      : bond.state === 'Severed'
        ? t('bond.severed')
        : bond.state === 'Faded'
          ? t('bond.faded')
          : bond.state === 'Retired'
            ? t('quests.retired')
            : bond.seals > 0
              ? t('bond.sealsBroken', { n: bond.seals })
              : t('bond.sealedMatched');
  const header = (
    <BondHeader
      name={other.name}
      status={status}
      portrait={first ? { id: first.id, url: first.url, thumbHash: first.thumbHash } : null}
      sealed={bond.seals < 1}
      onOpen={() => router.push(`/companion/${id}`)}
      onOptions={bond.state === 'Live' ? () => setOptions(true) : undefined}
    />
  );

  if (bond.state === 'Retired')
    return (
      <Scene header={header} centered>
        <RetiredTogether />
      </Scene>
    );

  if (bond.state === 'Severed' || bond.state === 'Faded') {
    const severed = bond.state === 'Severed';
    const elsewhere = bond.closedWhy === 'retired' && !bond.closedByMe;
    return (
      <Scene header={header}>
        {/* Figma 31:421: the broken seal, high in the room */}
        <View style={styles.closedTop} />
        <Art name={severed ? 'seal_broken' : 'seal_wax'} style={styles.seal} fit="contain" />
        <Txt variant="displayM" engraved align="center" accessibilityRole="header">
          {severed ? t('bond.severedTitle') : t('bond.fadedTitle')}
        </Txt>
        <Txt variant="voiceM" color="textSecondary" align="center">
          {elsewhere
            ? t('bond.retiredElsewhere', { name: other.name })
            : severed
              ? t('bond.severedBody')
              : t('bond.fadedBody')}
        </Txt>
      </Scene>
    );
  }

  const send = async (text: string) => {
    try {
      return await sendLetter(id, text);
    } catch (e) {
      toast(
        'error',
        e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('bond.sendFailed'),
      );
      return false;
    }
  };

  const heading =
    bond.embers && bond.myTurn && bond.coldAt && newest ? (
      <Banner
        smoulder
        text={t('bond.embers', {
          name: other.name,
          ago: hoursBetween(newest.createdAt, now),
          left: hoursBetween(now, bond.coldAt),
        })}
      />
    ) : null;

  return (
    <>
      <Scene
        header={header}
        bare
        footer={
          <View style={styles.composer}>
            <Composer
              placeholder={cold ? t('bond.coldComposer') : t('bond.composer')}
              sendLabel={t('bond.send')}
              disabled={cold}
              maxLength={LETTER_MAX}
              onSend={send}
            />
          </View>
        }
      >
        {loaded && letters.length === 0 && unsent.length === 0 ? (
          <NoWords bond={bond} myGender={me?.gender ?? null} />
        ) : (
          <View style={styles.letters}>
            {/* Figma 31:262: the warning stays under the header, not scrolled away with old letters */}
            {(heading || bond.state === 'Live' || road) && (
              <View style={styles.heading}>
                <RoadNotice />
                {heading}
                {bond.state === 'Live' && <NextStep bondId={id} name={other.name} />}
              </View>
            )}
            <FlatList
              inverted
              data={items}
              keyExtractor={(i) => i.key}
              contentContainerStyle={styles.list}
              onEndReached={more}
              onEndReachedThreshold={0.4}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                cold ? (
                  <Txt variant="voiceM" color="textSecondary" align="center" style={styles.coldLine}>
                    {bond.closedByMe ? t('bond.coldMine') : t('bond.coldTheirs')}
                  </Txt>
                ) : null
              }
              renderItem={({ item }) =>
                item.kind === 'unsent' ? (
                  <Letter text={item.text} mine time={t('bond.unsent')} />
                ) : item.kind === 'letter' ? (
                  <Letter text={item.letter.text} mine={item.letter.mine} time={item.time} />
                ) : item.kind === 'seal' ? (
                  <SealLine text={t(`bond.seal${Math.min(item.seal, SEALS) as 1 | 2 | 3 | 4}`)} />
                ) : (
                  <DayHeading text={item.text} />
                )
              }
            />
          </View>
        )}
      </Scene>
      {cold && <Frost opacity={FROST} />}
      <Sheet kind="menu" open={options} title={t('bond.optionsTitle')} onClose={() => setOptions(false)}>
        <View style={styles.options}>
          <CampaignRow
            bondId={id}
            go={(to) => {
              setOptions(false);
              router.push(to as never);
            }}
          />
          <Row
            title={t('bond.optSeals')}
            subtitle={t('bond.optSealsHint')}
            onPress={() => {
              setOptions(false);
              setConfirm('seals');
            }}
          />
          <Row
            title={t('bond.optReport')}
            subtitle={t('bond.optReportHint')}
            onPress={() => {
              setOptions(false);
              router.push(`/report/${other.accountId}?bond=${id}`);
            }}
          />
          <Row
            title={t('bond.optCastOut')}
            subtitle={t('bond.optCastOutHint')}
            onPress={() => {
              setOptions(false);
              setConfirm('castOut');
            }}
          />
          <Row
            title={t('bond.optSever')}
            subtitle={t('bond.optSeverHint')}
            onPress={() => {
              setOptions(false);
              setConfirm('sever');
            }}
          />
        </View>
      </Sheet>
      <Dialog
        open={confirm === 'sever' || confirm === 'castOut'}
        title={confirm === 'castOut' ? t('bond.castOutTitle') : t('bond.severTitle')}
        body={confirm === 'castOut' ? t('bond.castOutBody') : t('bond.severBody')}
        confirm={{
          label: confirm === 'castOut' ? t('bond.castOutConfirm') : t('bond.severConfirm'),
          danger: true,
          onPress: async () => {
            const what = confirm;
            setConfirm(null);
            try {
              if (what === 'castOut') {
                await castOut(other.accountId);
                router.back();
              } else await severBond(id);
            } catch (e) {
              toast('error', e instanceof ApiError ? tError(e.code, e.message) : t('error.generic'));
            }
          },
        }}
        cancel={{ label: t('common.cancel'), onPress: () => setConfirm(null) }}
      />
      <Dialog
        open={confirm === 'seals'}
        seal={false}
        title={t('bond.sealsTitle')}
        body={t('bond.sealsBody', {
          s1: bond.sealLadder[0] ?? 0,
          s2: bond.sealLadder[1] ?? 0,
          s3: bond.sealLadder[2] ?? 0,
          s4: bond.sealLadder[3] ?? 0,
        })}
        confirm={{ label: t('common.continue'), onPress: () => setConfirm(null) }}
        cancel={{ label: t('common.back'), onPress: () => setConfirm(null) }}
      />
    </>
  );
}

/** A bond no one has written in yet (Figma 31:3). */
function NoWords({ bond, myGender }: { bond: BondView; myGender: string | null }) {
  const body = myGender === 'Female' ? 'bond.newBodyHis' : 'bond.newBodyHer';
  return (
    <View style={styles.noWords}>
      <Art name="seal_wax" style={styles.seal} fit="contain" />
      <Txt variant="displayM" engraved align="center" accessibilityRole="header">
        {t('bond.newTitle')}
      </Txt>
      <Txt variant="voiceM" color="textSecondary" align="center">
        {t(body, { n: bond.nextSealAt ?? 5 })}
      </Txt>
      {bond.state === 'Live' && (
        <View style={styles.noWordsStep}>
          <NextStep bondId={bond.id} name={bond.other.name} />
        </View>
      )}
    </View>
  );
}

/** How strongly the frost lies once it has crept in (Figma). */
const FROST = 0.62;

const styles = StyleSheet.create({
  letters: { flex: 1, alignSelf: 'stretch' },
  closedTop: { height: dimension.space8 + dimension.space7 },
  heading: { paddingHorizontal: dimension.sizeGutter, paddingTop: dimension.space3, gap: dimension.space3 },
  noWordsStep: { alignSelf: 'stretch', marginTop: dimension.space4 },
  // flex-end in an inverted list is the top: a short conversation starts under the header (31:97)
  list: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: dimension.sizeGutter,
    paddingVertical: dimension.space3,
    gap: dimension.space3,
  },
  composer: { alignSelf: 'stretch' },
  coldLine: { paddingVertical: dimension.space4 },
  options: { alignSelf: 'stretch' },
  // Figma 31:3 sets it high, under the header (stage 4's "Break the ice" sits below it)
  noWords: {
    flex: 1,
    alignItems: 'center',
    gap: dimension.space4,
    padding: dimension.sizeGutter,
    paddingTop: dimension.space7,
  },
  seal: { width: 64, height: 64, alignSelf: 'center' },
});
