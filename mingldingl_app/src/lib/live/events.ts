import { hashKey, type Query, type QueryClient, type QueryKey } from '@tanstack/react-query';
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
  getGetFaceProofQueryKey,
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
import { type OwnWrite, ownWrite } from './writes';

/** Paged lists the app keeps as infinite queries (the generated keys carry page params). */
export const lettersKey = (bondId: string) => ['letters', bondId] as const;
export const deedsKey = ['deeds'] as const;

/** What the engine sends: which kind of thing changed and the ids it concerns — never the data. */
export type LiveEvent = { kind: string; ids: string[] };

/**
 * One write's events for one group, as one message. origin: the X-Live-Origin of the write that
 * caused them (ours, if we made it); all: a broadcast to everyone.
 */
export type LiveBatch = { events: LiveEvent[]; origin?: string | null; all?: boolean };

export const LIVE_KINDS = [
  'profile.updated',
  'photos.updated',
  'config.updated',
  'session.revoked',
  'score.changed',
  'bond.created',
  'bond.updated',
  'bond.read',
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
  'wandering.updated',
  'thread.updated',
  'square.updated',
  'codex.updated',
  'festival.updated',
  'membership.updated',
  'payment.updated',
] as const;
export type LiveKind = (typeof LIVE_KINDS)[number];

/**
 * What the road reads from (quests, the Encounter Log): the engine derives them from deeds, bonds
 * and meetings, so any of those events can move them. Honours are written by the engine when
 * earned and announced by honour.earned, so they are not here.
 */
const road = () => [getGetQuestsQueryKey(), getGetEncounterLogQueryKey()];

/**
 * invalidate: exact keys. under: every query whose path starts so. encounters: every encounter too
 * (a venue sits in lists, details and encounters).
 */
type LiveAction = { invalidate?: QueryKey[]; under?: string[]; encounters?: true; signOut?: true };

/** The one table from event kind to the data it makes stale — the live twin of the feedback table. */
export const LIVE: Record<LiveKind, (ids: string[]) => LiveAction> = {
  'profile.updated': () => ({
    invalidate: [getGetMeQueryKey(), getGetDeepProfileQueryKey(), getGetFaceProofQueryKey()],
  }),
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
  // Only the reader's own list: the unread dot.
  'bond.read': () => ({ invalidate: [getGetBondsQueryKey()] }),
  'letter.created': ([bond]) => ({
    invalidate: [getGetBondsQueryKey(), ...(bond ? [lettersKey(bond), getGetBondQueryKey(bond)] : [])],
  }),
  'seek.changed': () => ({ invalidate: [getGetSeekQueryKey()] }),
  'block.changed': () => ({ invalidate: [getGetBlocksQueryKey(), getGetSeekQueryKey()] }),
  'encounter.updated': ([bond]) => ({
    invalidate: [...(bond ? [getGetEncounterQueryKey(bond)] : []), ...road()],
  }),
  'video.call': ([bond]) => ({ invalidate: bond ? [getGetEncounterQueryKey(bond)] : [] }),
  'venue.updated': () => ({ under: ['/venues'], encounters: true, invalidate: [] }),
  'honour.earned': () => ({ invalidate: [getGetHonoursQueryKey()] }),
  'quests.updated': () => ({ invalidate: [getGetQuestsQueryKey(), getGetChestsQueryKey()] }),
  'campaign.updated': ([bond]) => ({
    invalidate: bond ? [getGetCampaignQueryKey(bond), getGetBondQueryKey(bond), getGetBondsQueryKey()] : [],
  }),
  'trial.updated': ([bond]) => ({ invalidate: bond ? [getGetWeeklyTrialQueryKey(bond)] : [] }),
  // An ask, an answer, a line; with no bond, the keepers changed a Wandering's words.
  'wandering.updated': ([bond]) => ({
    under: [bond ? `/bonds/${bond}/wanderings` : '/bonds/'],
    invalidate: [],
  }),
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

/** Events that land within this window are invalidated together, once. */
export const COALESCE_MS = 50;
/** A broadcast reaches everyone at once: each device waits up to this long before it refetches. */
export const BROADCAST_SPREAD_MS = 2_000;
/** The longest an echo of our own write waits for that write's answer. */
const OWN_WRITE_WAIT_MS = 10_000;

/** What one batch made stale, and when it arrived. */
type Slot = {
  exact: Set<string>;
  under: string[];
  encounters: boolean;
  at: number;
  own?: OwnWrite;
  resolve: () => void;
};
type Marks = { fetchAt: number; manualAt: number };
type State = { due: Slot[]; timer: ReturnType<typeof setTimeout> | null; marks: WeakMap<Query, Marks> };

const states = new WeakMap<QueryClient, State>();

/** Per client: when each query last started a fetch, and when a screen last wrote it by hand. */
function stateOf(client: QueryClient): State {
  let st = states.get(client);
  if (st) return st;
  const marks = new WeakMap<Query, Marks>();
  st = { due: [], timer: null, marks };
  client.getQueryCache().subscribe((e) => {
    if (e.type !== 'updated') return;
    const m = marks.get(e.query) ?? { fetchAt: 0, manualAt: 0 };
    if (e.action.type === 'fetch') m.fetchAt = Date.now();
    else if (e.action.type === 'success' && e.action.manual) m.manualAt = Date.now();
    else return;
    marks.set(e.query, m);
  });
  states.set(client, st);
  return st;
}

/**
 * Already fresh for this slot: a fetch started after the events arrived (a nudge read it, or
 * another event already refetched it), or — for our own write's echo — the screen put the write's
 * answer into the cache.
 */
function covered(m: Marks | undefined, slot: Slot) {
  if (!m) return false;
  return m.fetchAt >= slot.at || (slot.own !== undefined && m.manualAt >= slot.own.start);
}

function matches(q: Query, slot: Slot) {
  if (slot.exact.has(q.queryHash)) return true;
  const head = q.queryKey[0];
  if (typeof head !== 'string') return false;
  return slot.under.some((u) => head.startsWith(u)) || (slot.encounters && head.endsWith('/encounter'));
}

async function flush(client: QueryClient) {
  const st = stateOf(client);
  st.timer = null;
  const slots = st.due;
  st.due = [];
  const stale = new Set<Query>();
  for (const q of client.getQueryCache().getAll()) {
    const m = st.marks.get(q);
    if (slots.some((slot) => matches(q, slot) && !covered(m, slot))) stale.add(q);
  }
  try {
    if (stale.size) await client.invalidateQueries({ predicate: (q) => stale.has(q) });
  } finally {
    for (const slot of slots) slot.resolve();
  }
}

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * Applies one batch: listeners hear every event at once; the data it made stale is invalidated
 * with whatever else lands in the same 50 ms, once. An echo of our own write waits for the write's
 * answer first; a broadcast waits a random 0–2 s. Resolves when its invalidation is done.
 */
export async function applyLiveBatch(
  client: QueryClient,
  batch: LiveBatch,
  signOut: () => unknown,
): Promise<void> {
  const at = Date.now();
  const st = stateOf(client);
  const slot: Omit<Slot, 'resolve'> = {
    exact: new Set(),
    under: [],
    encounters: false,
    at,
    own: ownWrite(batch.origin),
  };
  for (const e of batch.events) {
    if (!isKind(e.kind)) {
      console.warn(`live: unknown kind ${e.kind}`);
      continue;
    }
    for (const fn of listeners) fn(e);
    const action = LIVE[e.kind](e.ids);
    if (action.signOut) {
      await signOut();
      return;
    }
    for (const k of action.invalidate ?? []) slot.exact.add(hashKey(k));
    slot.under.push(...(action.under ?? []));
    if (action.encounters) slot.encounters = true;
  }
  if (slot.exact.size === 0 && slot.under.length === 0 && !slot.encounters) return;

  if (slot.own) await Promise.race([slot.own.done.then(() => wait(10)), wait(OWN_WRITE_WAIT_MS)]);
  else if (batch.all) await wait(Math.random() * BROADCAST_SPREAD_MS);

  await new Promise<void>((resolve) => {
    st.due.push({ ...slot, resolve });
    st.timer ??= setTimeout(() => flush(client), COALESCE_MS);
  });
}

/** One event on its own (the developer tools, tests). */
export const applyLiveEvent = (client: QueryClient, e: LiveEvent, signOut: () => unknown) =>
  applyLiveBatch(client, { events: [e] }, signOut);

/** After a reconnect or a long background: whatever is on screen fetches once, then waits for events. */
export const refetchActiveOnce = (client: QueryClient) => client.refetchQueries({ type: 'active' });
