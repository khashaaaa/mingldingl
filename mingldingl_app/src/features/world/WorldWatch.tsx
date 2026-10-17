import * as Notifications from 'expo-notifications';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import {
  dawn,
  getBond,
  getCampaign,
  getDeeds,
  getEncounter,
  getGetEncounterQueryKey,
  getThreadInvitations,
  useGetHonours,
} from '@/lib/api/generated/engine';
import type { EncounterView } from '@/lib/api/generated/model';
import { feedback } from '@/lib/feedback';
import { type StringKey, t, tLine } from '@/lib/i18n';
import { onLiveEvent } from '@/lib/live/events';
import { registerPushToken } from '@/lib/push';
import { queryClient } from '@/lib/query';
import { toast } from '@/lib/toast';
import { TierUp } from '../ceremonies/TierUp';
import { encounterNudge } from '../encounters/NextStep';

/** Ulaanbaatar's calendar day (UTC+8, no daylight saving) — the engine's "today". */
const ubToday = () => new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10);

/**
 * What happens in the world beyond the screen in front of you: the daily return (once per
 * Ulaanbaatar day, on open and on coming back), the tier-up ceremony, and the nudges — a live event
 * for something not on screen shows its toast with its haptic and sound.
 */
export function WorldWatch() {
  useDawn();
  useNudges();
  usePush();
  useHonours();
  return <TierUp />;
}

/**
 * An honour earned and not yet seen plays its ceremony, one at a time, wherever you are (the
 * engine reads honours from what you did, so the list refreshes on the events that could earn one).
 */
function useHonours() {
  const unseen = useGetHonours().data?.find((h) => h.unseen)?.key;
  const path = usePathname();
  // A night at the square shows its own moments; an honour earned there waits until you leave it.
  const away = path.startsWith('/square');
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!unseen || away || shown.current === unseen) return;
    shown.current = unseen;
    router.push(`/ceremony/honour/${unseen}`);
  }, [unseen, away]);
}

function useDawn() {
  const last = useRef<string | null>(null);
  useEffect(() => {
    const check = () => {
      const today = ubToday();
      if (last.current === today) return;
      last.current = today;
      dawn()
        .then((r) => {
          if (r.earned <= 0) return;
          feedback('rewardBurst');
          // The seventh dawn has its own ceremony (Figma 36:388); any other dawn is a toast.
          if (r.seventh) router.push(`/ceremony/dawns?points=${r.earned}`);
          else toast('reward', tLine('nudge.reward', { deed: 'deed.dawn' }, { points: `+${r.earned}` }));
        })
        .catch(() => {
          last.current = null;
        });
    };
    check();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);
}

/** Registers this device for pushes (each sign-in is a new device session) and opens a tapped one. */
function usePush() {
  const tapped = Notifications.useLastNotificationResponse();
  const opened = useRef<string | null>(null);
  useEffect(() => {
    registerPushToken();
  }, []);
  useEffect(() => {
    if (!tapped || tapped.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = tapped.notification.request.identifier;
    if (opened.current === id) return;
    opened.current = id;
    const bondId = tapped.notification.request.content.data?.bondId;
    if (typeof bondId === 'string') router.push(`/bond/${bondId}`);
  }, [tapped]);
}

function useNudges() {
  const path = usePathname();
  const here = useRef(path);
  here.current = path;
  useEffect(
    () =>
      onLiveEvent(async (e) => {
        const [id] = e.ids;
        try {
          if (e.kind === 'bond.created' && id) {
            const b = await getBond(id);
            // The summoner is already on the ceremony; the one summoned gets it too, live (stage 3 spec).
            // ("Fate has woven you a new match" is the Fated Threads nudge, stage 5.)
            // At the square the night shows its own "two yeses"; the ceremony waits for the letters.
            if (b.summonedByMe || here.current.startsWith('/square')) return;
            router.push(`/ceremony/bond/${id}`);
          } else if (e.kind === 'letter.created' && id) {
            if (here.current === `/bond/${id}`) return;
            const b = await getBond(id);
            if (!b.myTurn) return;
            feedback('bell');
            toast('info', t('nudge.letter', { name: b.other.name }));
          } else if (e.kind === 'encounter.updated' && id) {
            const key = getGetEncounterQueryKey(id);
            const before = queryClient.getQueryData<EncounterView>(key);
            const now = await getEncounter(id);
            queryClient.setQueryData(key, now);
            const nudge = encounterNudge(before, now);
            if (!nudge || here.current.includes(id)) return;
            const b = await getBond(id);
            feedback('bell');
            toast('info', t(nudge, { name: b.other.name }));
          } else if (e.kind === 'thread.updated' && id) {
            // A thread newly woven for me (the weaver's own events are theirs to see in the Thread Log).
            const mine = (await getThreadInvitations()).find((th) => th.id === id);
            if (!mine || mine.myAnswer !== null || Date.now() - Date.parse(mine.wovenAt) > 60_000) return;
            feedback('bell');
            toast('info', t('nudge.thread', { name: mine.weaver }));
          } else if (e.kind === 'campaign.updated' && id) {
            // Asked to retire together: the one nudge the Campaign makes.
            if (here.current.includes(id)) return;
            const c = await getCampaign(id);
            if (c.retire !== 'askedByThem') return;
            const b = await getBond(id);
            feedback('bell');
            toast('info', t('nudge.retire', { name: b.other.name }));
          } else if (e.kind === 'score.changed') {
            const last = (await getDeeds({ limit: 1 })).items[0];
            // The daily return shows its own toast; anything older than a minute is not news.
            if (!last || last.kind === 'dawn' || last.kind === 'seventhDawn') return;
            if (Date.now() - Date.parse(last.createdAt) > 60_000) return;
            const points = last.amount > 0 ? `+${last.amount}` : `−${-last.amount}`;
            if (last.amount > 0) feedback('rewardBurst');
            toast(
              last.amount > 0 ? 'reward' : 'error',
              tLine('nudge.reward', { deed: `deed.${last.kind}` as StringKey }, { points }),
            );
          }
        } catch {
          // A nudge is a courtesy; the data itself still refreshes through the live table.
        }
      }),
    [],
  );
}
