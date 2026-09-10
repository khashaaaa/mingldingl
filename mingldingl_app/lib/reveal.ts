/**
 * The progressive-reveal ladder. The engine's `reveal.levelN.messages` keys are admin-tunable,
 * so the counts here are only a pre-fetch fallback: `useRevealThresholds` hydrates the live
 * values, the same way `lib/tiers.ts` treats gem-tier thresholds. Level 1 is the floor every
 * match is born with; levels 2–4 are the ones a conversation has to earn.
 */
const DEFAULT_LADDER = [1, 5, 15, 30];
const LEVELS = [1, 2, 3, 4] as const;

/**
 * Mutual messages before the engine will hand back activity suggestions
 * (`activity.suggestions.messages`). Admin-tunable like the ladder, and travelling on the same
 * response, because the app otherwise had no way to learn it except by being refused — so it
 * offered the door unconditionally and had no countdown to put beside it.
 */
const DEFAULT_ACTIVITY_GATE = 15;

let ladder: number[] = DEFAULT_LADDER;
let activityGate = DEFAULT_ACTIVITY_GATE;
let hydrated = false;
const listeners = new Set<() => void>();

export function hydrateRevealThresholds(
  raw: readonly { level?: number; messages?: number }[],
  activitySuggestionMessages?: number,
): void {
  const byLevel = new Map(raw.map((t) => [t.level, t.messages]));
  const ordered = LEVELS.map((level) => byLevel.get(level));
  if (ordered.some((v) => typeof v !== 'number')) return;
  const next = ordered as number[];
  const nextGate = typeof activitySuggestionMessages === 'number' && activitySuggestionMessages > 0
    ? activitySuggestionMessages
    : activityGate;
  hydrated = true;
  if (next.every((v, i) => v === ladder[i]) && nextGate === activityGate) return;
  ladder = next;
  activityGate = nextGate;
  for (const notify of listeners) notify();
}

/** Mutual messages still needed before activity suggestions unlock, or 0 once they have. */
export function messagesUntilActivities(messageCount: number, gate: number = activityGate): number {
  return Math.max(0, gate - messageCount);
}

export function activityGateSnapshot(): number {
  return activityGate;
}

export function areRevealThresholdsHydrated(): boolean {
  return hydrated;
}

/**
 * The ladder is module state so the pure helpers below stay callable outside React, but a screen
 * rendered before the query resolves would otherwise sit on the defaults forever. `useRevealLadder`
 * subscribes to hydration; the snapshot is a stable reference between changes.
 */
export function subscribeToRevealThresholds(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => { listeners.delete(onChange); };
}

export function revealLadderSnapshot(): number[] {
  return ladder;
}

/** The message count at which the next reveal unlocks, or null once the ladder is complete. */
export function nextRevealThreshold(messageCount: number, from: number[] = ladder): number | null {
  return from.slice(1).find((t) => messageCount < t) ?? null;
}

/**
 * The top rung of the ladder — the one that carries the deep-profile fields. Derived from the
 * ladder rather than written as a literal so the app and `LEVELS` cannot fall out of step if a
 * rung is ever added or removed.
 */
export function deepRevealLevel(from: number[] = ladder): number {
  return from.length;
}

/** Messages a match needs before deep-profile fields show. */
export function deepProfileThreshold(from: number[] = ladder): number {
  return from[from.length - 1];
}

export function resetRevealThresholdsForTests(): void {
  ladder = DEFAULT_LADDER;
  activityGate = DEFAULT_ACTIVITY_GATE;
  hydrated = false;
  listeners.clear();
}
