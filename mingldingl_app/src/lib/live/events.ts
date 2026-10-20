import type { QueryClient, QueryKey } from '@tanstack/react-query';
import {
  getGetAppStatusQueryKey,
  getGetBlocksQueryKey,
  getGetBondQueryKey,
  getGetBondsQueryKey,
  getGetCampaignQueryKey,
  getGetChestsQueryKey,
  getGetCitiesQueryKey,
  getGetDeepProfileQueryKey,
  getGetEncounterLogQueryKey,
  getGetEncounterQueryKey,
  getGetHallQueryKey,
  getGetHonoursQueryKey,
  getGetMembershipQueryKey,
  getGetMeQueryKey,
  getGetQuestsQueryKey,
  getGetSeasonQueryKey,
  getGetSeekQueryKey,
  getGetThreadInvitationsQueryKey,
  getGetTiersQueryKey,
  getGetWeeklyTrialQueryKey,
  getGetWovenThreadsQueryKey,
  getListMyPhotosQueryKey,
} from '../api/generated/engine';

/** Paged lists the app keeps as infinite queries (the generated keys carry page params). */
export const lettersKey = (bondId: string) => ['letters', bondId] as const;
export const deedsKey = ['deeds'] as const;

/** What the engine sends: which kind of thing changed and the ids it concerns — never the data. */
export type LiveEvent = { kind: string; ids: string[] };

export const LIVE_KINDS = [
  'profile.updated',
  'photos.updated',
  'config.updated',
  'session.revoked',
  'score.changed',
  'bond.created',
  'bond.updated',
  'letter.created',
  'seek.changed',
  'block.changed',
  'encounter.updated',
  'video.call',
  'venue.updated',
  'honour.earned',
  'quests.updated',
  'campaign.updated',
  'trial.updated',
  'thread.updated',
  'square.updated',
  'codex.updated',
  'festival.updated',
  'membership.updated',
  'payment.updated',
] as const;
export type LiveKind = (typeof LIVE_KINDS)[number];

/**
 * What the road reads from (quests, honours, the Encounter Log): the engine derives them from
 * deeds, bonds and meetings, so any of those events can move them.
 */
const road = () => [getGetQuestsQueryKey(), getGetHonoursQueryKey(), getGetEncounterLogQueryKey()];

/** invalidate: exact keys. under: every query whose path starts so (a venue sits in lists, details and encounters). */
type LiveAction = { invalidate?: QueryKey[]; under?: string[]; signOut?: true };

/** The one table from event kind to the data it makes stale — the live twin of the feedback table. */
export const LIVE: Record<LiveKind, (ids: string[]) => LiveAction> = {
  'profile.updated': () => ({ invalidate: [getGetMeQueryKey(), getGetDeepProfileQueryKey()] }),
  'photos.updated': () => ({ invalidate: [getGetMeQueryKey(), getListMyPhotosQueryKey()] }),
  'config.updated': () => ({
    invalidate: [
      getGetAppStatusQueryKey(),
      getGetCitiesQueryKey(),
      getGetTiersQueryKey(),
      getGetSeekQueryKey(),
      getGetSeasonQueryKey(),
    ],
  }),
  'session.revoked': () => ({ signOut: true }),
  'score.changed': () => ({
    invalidate: [getGetMeQueryKey(), deedsKey, getGetSeekQueryKey(), getGetHallQueryKey(), ...road()],
  }),
  'bond.created': () => ({ invalidate: [getGetBondsQueryKey(), getGetSeekQueryKey(), ...road()] }),
  'bond.updated': ([bond]) => ({
    invalidate: [
      getGetBondsQueryKey(),
      ...(bond
        ? [
            getGetBondQueryKey(bond),
            lettersKey(bond),
            getGetCampaignQueryKey(bond),
            getGetWeeklyTrialQueryKey(bond),
          ]
        : []),
      ...road(),
    ],
  }),
  'letter.created': ([bond]) => ({
    invalidate: [getGetBondsQueryKey(), ...(bond ? [lettersKey(bond), getGetBondQueryKey(bond)] : [])],
  }),
  'seek.changed': () => ({ invalidate: [getGetSeekQueryKey()] }),
  'block.changed': () => ({ invalidate: [getGetBlocksQueryKey(), getGetSeekQueryKey()] }),
  'encounter.updated': ([bond]) => ({
    invalidate: [...(bond ? [getGetEncounterQueryKey(bond)] : []), ...road()],
  }),
  'video.call': ([bond]) => ({ invalidate: bond ? [getGetEncounterQueryKey(bond)] : [] }),
  'venue.updated': () => ({ under: ['/venues'], invalidate: [] }),
  'honour.earned': () => ({ invalidate: [getGetHonoursQueryKey()] }),
  'quests.updated': () => ({ invalidate: [getGetQuestsQueryKey(), getGetChestsQueryKey()] }),
  'campaign.updated': ([bond]) => ({
    invalidate: bond ? [getGetCampaignQueryKey(bond), getGetBondQueryKey(bond), getGetBondsQueryKey()] : [],
  }),
  'trial.updated': ([bond]) => ({ invalidate: bond ? [getGetWeeklyTrialQueryKey(bond)] : [] }),
  'thread.updated': () => ({ invalidate: [getGetThreadInvitationsQueryKey(), getGetWovenThreadsQueryKey()] }),
  // A seat, a bell, a pairing, a result: the tab and the night read again.
  'square.updated': () => ({ under: ['/square'], invalidate: [] }),
  'codex.updated': () => ({ under: ['/codex'], invalidate: [] }),
  'festival.updated': () => ({ invalidate: [getGetSeasonQueryKey()] }),
  // A floor opened, renewed, ended or was refunded: seats and summons move with it.
  'membership.updated': () => ({
    invalidate: [getGetMembershipQueryKey(), getGetMeQueryKey(), getGetSeekQueryKey()],
  }),
  // The web page's invoices; the app shows the floor, which membership.updated carries.
  'payment.updated': () => ({ invalidate: [] }),
};

type Listener = (e: LiveEvent) => void;
const listeners = new Set<Listener>();

/** For what reacts to an event beyond fresh data (nudges, ceremonies). Returns the unsubscribe. */
export function onLiveEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

const isKind = (k: string): k is LiveKind => (LIVE_KINDS as readonly string[]).includes(k);

export async function applyLiveEvent(
  client: QueryClient,
  e: LiveEvent,
  signOut: () => unknown,
): Promise<void> {
  if (!isKind(e.kind)) {
    console.warn(`live: unknown kind ${e.kind}`);
    return;
  }
  for (const fn of listeners) fn(e);
  const action = LIVE[e.kind](e.ids);
  if (action.signOut) {
    await signOut();
    return;
  }
  const under = action.under ?? [];
  await Promise.all([
    ...(action.invalidate ?? []).map((queryKey) => client.invalidateQueries({ queryKey, exact: true })),
    ...(under.length
      ? [
          client.invalidateQueries({
            predicate: (q) => {
              const head = q.queryKey[0];
              return (
                typeof head === 'string' &&
                (under.some((u) => head.startsWith(u)) || head.endsWith('/encounter'))
              );
            },
          }),
        ]
      : []),
  ]);
}

/** After a reconnect or a long background: whatever is on screen fetches once, then waits for events. */
export const refetchActiveOnce = (client: QueryClient) => client.refetchQueries({ type: 'active' });
