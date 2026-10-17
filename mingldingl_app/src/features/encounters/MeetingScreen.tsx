import { useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { Art } from '@/design/components/Art';
import { Banner } from '@/design/components/Banner';
import { Button } from '@/design/components/Button';
import { Dialog } from '@/design/components/Dialog';
import { Glow } from '@/design/components/Glow';
import { InkLink } from '@/design/components/InkLink';
import { PickRow } from '@/design/components/PickRow';
import { Reveal } from '@/design/components/Reveal';
import { RoomHeader } from '@/design/components/RoomHeader';
import { SealStamp } from '@/design/components/SealStamp';
import { Sheet } from '@/design/components/Sheet';
import { StateBlock } from '@/design/components/StateBlock';
import { Txt } from '@/design/components/Txt';
import { VenueCard } from '@/design/components/VenueCard';
import { color, dimension } from '@/design/tokens';
import { ApiError } from '@/lib/api/client';
import {
  callOffMeeting,
  getGetEncounterQueryKey,
  pledgeMeeting,
  proposeMeeting,
  useGetBond,
  useGetEncounter,
  useGetVenue,
  useListVenues,
} from '@/lib/api/generated/engine';
import type { EncounterView, MeetingView, VenueView } from '@/lib/api/generated/model';
import { feedback } from '@/lib/feedback';
import { type StringKey, t, tError, tPlace } from '@/lib/i18n';
import { toast } from '@/lib/toast';
import { Scene } from '../common/Scene';
import { when } from './NextStep';

/** "CAFE · SÜKHBAATAR" */
export const eyebrow = (v: VenueView) => `${t(`kind.${v.kind}` as StringKey)} · ${tPlace(v.district)}`;
export const ratingLine = (v: VenueView) =>
  v.rating == null ? t('venue.noRatings') : `★ ${v.rating.toFixed(1)} (${v.ratings})`;

/** The next fortnight, from today; and the hours a first meeting suits (10:00 – 21:30). */
const DAYS = 14;
const HOURS = Array.from({ length: 24 }, (_, i) => [10 + Math.floor(i / 2), (i % 2) * 30] as const);
const EARLIEST_MS = 2 * 3_600_000;

function slot(day: number, h: number, m: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + day);
  d.setHours(h, m, 0, 0);
  return d;
}

/**
 * Encounter (Figma 33:1414 where to meet · 33:1487 pledge · 33:1566 sworn · 33:1701 gone): choosing a
 * verified place and a time, pledging, and the sworn meeting with its safety share.
 */
export default function MeetingScreen() {
  const { id, venue: picked, again } = useLocalSearchParams<{ id: string; venue?: string; again?: string }>();
  const client = useQueryClient();
  const name = useGetBond(id).data?.other.name ?? '';
  const encounter = useGetEncounter(id).data;
  const current = encounter?.meeting?.current ?? null;
  const header = <RoomHeader title={t('room.encounter')} onBack={() => router.back()} />;

  const apply = (view: EncounterView) => client.setQueryData(getGetEncounterQueryKey(id), view);
  const fail = (e: unknown) =>
    toast(
      'error',
      e instanceof ApiError && e.kind === 'rule' ? tError(e.code, e.message) : t('error.generic'),
    );

  if (!encounter) return <Scene header={header}>{null}</Scene>;
  // A place chosen for a new proposal (first, or "suggest another time").
  if (picked) return <Propose bondId={id} venueId={picked} header={header} apply={apply} fail={fail} />;
  if (!current || again || current.state === 'CalledOff') return <Choose bondId={id} header={header} />;
  if (current.venue.gone && current.state === 'Proposed')
    return (
      <Scene
        header={header}
        centered
        footer={
          <Button
            label={t('venue.chooseAnother')}
            kind="plain"
            onPress={() => router.setParams({ again: '1' })}
            block
          />
        }
      >
        <View style={styles.page}>
          <Art name="venue_gone" style={styles.gone} fit="contain" />
          <Txt variant="displayL" engraved align="center" accessibilityRole="header">
            {t('venue.goneTitle')}
          </Txt>
          <Txt variant="voiceM" color="textSecondary" align="center">
            {t('venue.goneBody')}
          </Txt>
        </View>
      </Scene>
    );
  // After its hour the meeting is asked about, then (kept) rated: those screens own it.
  if (current.state === 'Checking') return <Redirect href={`/attendance/${id}`} />;
  if (current.state === 'Closed') return <Redirect href={`/rate/${id}`} />;
  if (current.state === 'Sworn')
    return (
      <Sworn
        bondId={id}
        meeting={current}
        name={name}
        reward={encounter.rewards.meeting}
        header={header}
        apply={apply}
        fail={fail}
      />
    );
  return <Pledge bondId={id} meeting={current} name={name} header={header} apply={apply} fail={fail} />;
}

type Act = { header: React.ReactNode; apply: (v: EncounterView) => void; fail: (e: unknown) => void };

/** Where shall you meet? (33:1414) — the verified places, nearest the pair first. */
function Choose({ bondId, header }: { bondId: string; header: React.ReactNode }) {
  const venues = useListVenues({ bond: bondId }).data;
  return (
    <Scene header={header}>
      <Txt variant="displayM" engraved accessibilityRole="header">
        {t('meeting.whereTitle')}
      </Txt>
      <Txt variant="voiceM" color="textSecondary">
        {t('meeting.whereBody')}
      </Txt>
      {venues?.length === 0 && <StateBlock kind="empty" title={t('meeting.noPlaces')} />}
      <View style={styles.list}>
        {venues?.map((v) => (
          <VenueCard
            key={v.id}
            photo={v.photos[0] ?? null}
            eyebrow={eyebrow(v)}
            name={v.name}
            meta={`${ratingLine(v)} · ${t('meeting.verified')}`}
            onPress={() => router.push(`/venue/${v.id}?bond=${bondId}`)}
          />
        ))}
      </View>
    </Scene>
  );
}

/** A new proposal at a chosen place: the day and the hour, then my pledge. */
function Propose({ bondId, venueId, header, apply, fail }: Act & { bondId: string; venueId: string }) {
  const venue = useGetVenue(venueId).data;
  const [day, setDay] = useState<number | null>(null);
  const [time, setTime] = useState<number | null>(null);
  const [sheet, setSheet] = useState<'day' | 'time' | null>(null);
  const [busy, setBusy] = useState(false);
  const earliest = Date.now() + EARLIEST_MS;
  const hours = useMemo(
    () =>
      HOURS.map(([h, m], i) => ({ i, h, m })).filter(
        ({ h, m }) => day === null || slot(day, h, m).getTime() >= earliest,
      ),
    [day, earliest],
  );
  const at = day !== null && time !== null ? slot(day, HOURS[time]?.[0] ?? 0, HOURS[time]?.[1] ?? 0) : null;
  const dayLabel = (d: number) => when(slot(d, 12, 0).toISOString()).split(' · ')[0] ?? '';
  const hourLabel = (i: number) =>
    `${String(HOURS[i]?.[0]).padStart(2, '0')}:${String(HOURS[i]?.[1]).padStart(2, '0')}`;

  const pledge = async () => {
    if (!at) return;
    setBusy(true);
    try {
      apply(await proposeMeeting(bondId, { venueId, at: at.toISOString() }));
      feedback('sealStamp');
      router.replace(`/meeting/${bondId}`);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  if (!venue) return <Scene header={header}>{null}</Scene>;
  return (
    <Scene
      header={header}
      footer={<Button label={t('meeting.pledge')} onPress={pledge} disabled={!at} loading={busy} block />}
    >
      <VenueCard
        photo={venue.photos[0] ?? null}
        eyebrow={eyebrow(venue)}
        name={venue.name}
        meta={at ? when(at.toISOString()) : t('meeting.choose')}
      />
      <View style={styles.rows}>
        <PickRow label={day === null ? t('meeting.day') : dayLabel(day)} onPress={() => setSheet('day')} />
        <PickRow
          label={time === null ? t('meeting.hour') : hourLabel(time)}
          onPress={() => setSheet('time')}
        />
      </View>
      <Txt variant="voiceM" color="textSecondary">
        {t('meeting.promise')}
      </Txt>
      <Sheet kind="menu" open={sheet !== null} title={t('meeting.choose')} onClose={() => setSheet(null)}>
        <View style={styles.sheet}>
          {sheet === 'day'
            ? Array.from({ length: DAYS }, (_, d) => d)
                .filter((d) => slot(d, 21, 30).getTime() >= earliest)
                .map((d) => (
                  <PickRow
                    key={d}
                    label={dayLabel(d)}
                    selected={day === d}
                    onPress={() => {
                      setDay(d);
                      setTime(null);
                      setSheet('time');
                    }}
                  />
                ))
            : hours.map(({ i }) => (
                <PickRow
                  key={i}
                  label={hourLabel(i)}
                  selected={time === i}
                  onPress={() => {
                    setTime(i);
                    setSheet(null);
                  }}
                />
              ))}
        </View>
      </Sheet>
    </Scene>
  );
}

/** A proposal on the table (33:1487): theirs to pledge to, or mine waiting for them. */
function Pledge({
  bondId,
  meeting,
  name,
  header,
  apply,
  fail,
}: Act & { bondId: string; meeting: MeetingView; name: string }) {
  const [busy, setBusy] = useState(false);
  const pledge = async () => {
    setBusy(true);
    try {
      apply(await pledgeMeeting(bondId, meeting.id));
      feedback('rewardBurst');
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const withdraw = async () => {
    try {
      apply(await callOffMeeting(bondId, meeting.id));
    } catch (e) {
      fail(e);
    }
  };
  const v = meeting.venue;
  return (
    <Scene
      header={header}
      footer={
        meeting.myPledge ? (
          <InkLink label={t('meeting.callOff')} onPress={withdraw} />
        ) : (
          <View style={styles.footer}>
            <Button label={t('meeting.pledge')} onPress={pledge} loading={busy} block />
            <InkLink label={t('meeting.suggest')} onPress={() => router.setParams({ venue: v.id })} />
          </View>
        )
      }
    >
      <VenueCard
        photo={v.photos[0] ?? null}
        eyebrow={eyebrow(v)}
        name={v.name}
        meta={when(meeting.at)}
        onPress={() => router.push(`/venue/${v.id}`)}
      />
      <Banner
        glyph="bell"
        tint="textAccent"
        text={meeting.myPledge ? t('meeting.youPledged', { name }) : t('meeting.theyPledged', { name })}
      />
      <Txt variant="voiceM" color="textSecondary">
        {t('meeting.promise')}
      </Txt>
    </Scene>
  );
}

/** The meeting is sworn (33:1566): the share for a friend, and a way to call it off before it starts. */
/** Sworn meetings whose seal this run of the app has already stamped. */
const SEEN = new Set<string>();
const stamped = () => feedback('sealStamp');

function Sworn({
  bondId,
  meeting,
  name,
  reward,
  header,
  apply,
  fail,
}: Act & { bondId: string; meeting: MeetingView; name: string; reward: number }) {
  const [confirm, setConfirm] = useState(false);
  // The oath's seal is stamped the first time it is seen; after that it simply lies there.
  const [first] = useState(() => !SEEN.has(meeting.id));
  SEEN.add(meeting.id);
  const v = meeting.venue;
  const share = () =>
    Share.share({
      message: t('meeting.shareText', {
        name,
        venue: v.name,
        address: v.address,
        district: tPlace(v.district),
        when: when(meeting.at),
      }),
    }).catch(() => {});
  const callOff = async () => {
    setConfirm(false);
    try {
      apply(await callOffMeeting(bondId, meeting.id));
    } catch (e) {
      fail(e);
    }
  };
  return (
    <Scene
      header={header}
      footer={
        <View style={styles.footer}>
          <Button label={t('meeting.share')} kind="plain" onPress={share} block />
          <InkLink label={t('common.backToLetters')} onPress={() => router.back()} />
        </View>
      }
    >
      <View style={styles.page}>
        <View style={styles.art}>
          <View style={styles.light}>
            <Glow tint={color.accentGoldBright} strength={0.35} breathe={false} />
          </View>
          <SealStamp name="meeting_seal" size={140} delay={first ? 300 : 0} still={!first} onLand={stamped} />
        </View>
        <Reveal delay={first ? 700 : 0}>
          <Txt variant="displayL" engraved align="center" accessibilityRole="header">
            {t('meeting.swornTitle')}
          </Txt>
        </Reveal>
        <Reveal delay={first ? 700 : 0} order={1}>
          <Txt variant="voiceM" color="textSecondary" align="center">
            {t('meeting.swornBody', { when: when(meeting.at), venue: v.name })}
          </Txt>
        </Reveal>
        <Reveal delay={first ? 700 : 0} order={2}>
          <Txt variant="labelM" color="textAccent" align="center">
            {t('meeting.reward', { points: `+${reward}` }).toUpperCase()}
          </Txt>
        </Reveal>
        {Date.parse(meeting.at) > Date.now() && (
          <InkLink label={t('meeting.callOff')} onPress={() => setConfirm(true)} />
        )}
      </View>
      <Dialog
        open={confirm}
        title={t('meeting.calledOffTitle')}
        body={t('meeting.calledOffBody', { name })}
        confirm={{ label: t('meeting.callOff'), onPress: callOff, danger: true }}
        cancel={{ label: t('call.stay'), onPress: () => setConfirm(false) }}
      />
    </Scene>
  );
}

const styles = StyleSheet.create({
  page: { alignItems: 'center', gap: dimension.space3, paddingTop: dimension.space7 },
  art: { width: 140, height: 140 },
  light: { position: 'absolute', left: -60, right: -60, top: -60, bottom: -60 },
  gone: { width: 220, height: 180 },
  list: { gap: dimension.space4 },
  rows: { marginHorizontal: -dimension.sizeGutter },
  sheet: { alignSelf: 'stretch' },
  footer: { alignSelf: 'stretch', alignItems: 'center', gap: dimension.space3 },
});
