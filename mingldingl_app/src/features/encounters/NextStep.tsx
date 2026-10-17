import { router } from 'expo-router';
import { NextAction } from '@/design/components/NextAction';
import { Reveal } from '@/design/components/Reveal';
import type { GlyphName } from '@/design/glyphs';
import { useGetEncounter, useGetWeeklyTrial } from '@/lib/api/generated/engine';
import type { EncounterView, MeetingView } from '@/lib/api/generated/model';
import { getLocale, type StringKey, t } from '@/lib/i18n';

type Step = { glyph: GlyphName; title: string; body: string; route: string };

/** "Sunday · 15:00" in the person's language, on their clock. */
export function when(iso: string): string {
  const d = new Date(iso);
  const day = d.toLocaleDateString(getLocale() === 'mn' ? 'mn-MN' : 'en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  return `${day} · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const whereWhen = (m: MeetingView) => `${m.venue.name}, ${when(m.at)}`;

const line = (key: string, vars?: Record<string, string>) => ({
  title: t(`${key}.title` as StringKey, vars),
  body: t(`${key}.body` as StringKey, vars),
});

/** The one thing the bond can do next, as the Bond's card shows it (null: nothing waits). */
export function stepOf(bondId: string, name: string, e: EncounterView | undefined): Step | null {
  if (!e?.next) return null;
  const m = e.meeting?.current;
  switch (e.next) {
    case 'icebreaker':
      return {
        glyph: 'ice',
        route: `/icebreaker/${bondId}`,
        ...line(e.icebreaker?.mine ? 'step.icebreakerSealed' : 'step.icebreaker'),
      };
    case 'trial':
      return {
        glyph: 'target',
        route: `/trial/${bondId}`,
        ...line((e.trial?.mine.length ?? 0) >= 5 ? 'step.trialSealed' : 'step.trial'),
      };
    case 'rite': {
      const s = e.rite?.state;
      const key =
        s === 'proposedByThem'
          ? 'step.riteAsked'
          : s === 'proposedByMe'
            ? 'step.riteMine'
            : s === 'accepted'
              ? 'step.riteAgreed'
              : 'step.rite';
      return { glyph: 'flame', route: `/rite/${bondId}`, ...line(key, { name }) };
    }
    case 'meeting': {
      if (!m) return { glyph: 'signpost', route: `/meeting/${bondId}`, ...line('step.meeting') };
      const key =
        m.state === 'Sworn' ? 'step.meetingSworn' : m.myPledge ? 'step.meetingMine' : 'step.meetingTheirs';
      return { glyph: 'pledge', route: `/meeting/${bondId}`, ...line(key, { name, where: whereWhen(m) }) };
    }
    case 'attendance':
      return { glyph: 'waypoint', route: `/attendance/${bondId}`, ...line('step.attendance', { name }) };
    case 'rate':
      return m
        ? { glyph: 'star', route: `/rate/${bondId}`, ...line('step.rate', { venue: m.venue.name }) }
        : null;
    default:
      return null;
  }
}

/** Figma Next Action (30:99) for this bond's next step; nothing when no step waits. */
export function NextStep({ bondId, name }: { bondId: string; name: string }) {
  const encounter = useGetEncounter(bondId).data;
  const weekly = useGetWeeklyTrial(bondId).data;
  // The week's trial waits behind any encounter step, and only while some game is mine to answer.
  const step =
    stepOf(bondId, name, encounter) ??
    (weekly?.games.some((g) => !g.answered)
      ? {
          glyph: weekly.kind === 'threeGames' ? ('pennant' as const) : ('scroll' as const),
          route: `/weekly/${bondId}`,
          ...line(weekly.kind === 'threeGames' ? 'step.games' : 'step.weekly'),
        }
      : null);
  if (!step) return null;
  // A step that opens (live, mid-conversation) bleeds in rather than appearing.
  return (
    <Reveal key={step.title}>
      <NextAction
        glyph={step.glyph}
        title={step.title}
        body={step.body}
        onPress={() => router.push(step.route as never)}
      />
    </Reveal>
  );
}

/**
 * The nudge (Figma 70:5304) an encounter change earns, read by comparing what this device last saw
 * with the fresh view — the live event itself says only "this bond's encounter changed".
 */
export function encounterNudge(old: EncounterView | undefined, now: EncounterView): StringKey | null {
  if (!old) return null;
  if (old.icebreaker?.mine && !old.icebreaker.revealed && now.icebreaker?.revealed) return 'nudge.icebreaker';
  if (old.trial && !old.trial.result && now.trial?.result && (old.trial.mine.length ?? 0) >= 5)
    return 'nudge.trial';
  if (old.rite?.state !== 'proposedByThem' && now.rite?.state === 'proposedByThem') return 'nudge.rite';
  const was = old.meeting?.current;
  const is = now.meeting?.current;
  if (is?.state === 'Sworn' && was?.state === 'Proposed' && was.myPledge) return 'nudge.meeting';
  if (is?.state === 'Proposed' && !is.myPledge && (was?.id !== is.id || was?.state !== 'Proposed'))
    return 'nudge.meetingProposed';
  return null;
}
