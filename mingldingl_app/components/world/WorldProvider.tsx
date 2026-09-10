import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useGlobalSearchParams, useSegments } from 'expo-router';
import { useSharedValue, withSpring, withTiming, type SharedValue } from 'react-native-reanimated';
import {
  LIGHT, LIGHT_FADE_MS, LIGHT_SPRING, ROOMS, WORLD_ENABLED, applyPhase, dayPhase, roomFor,
  type DayPhase, type LightRecipe, type RoomName,
} from '../../lib/world';
import { useWorldState } from '../../hooks/useWorldState';
import { setFeedbackMuted, signal } from '../../lib/world/feedback';
import { motionAllowed, useVfxLevel } from '../../lib/vfx';

interface WorldValue {
  /** null while the route is deliberately unlit, or the whole layer is switched off. */
  room: RoomName | null;
  recipe: LightRecipe | null;
  /** 0..1. Read by the floor and the canopy; never re-renders a screen. */
  light: SharedValue<number>;
  /** Time of day, off the device clock. The canopy colours its edge by it. */
  phase: DayPhase;
}

/** How often the hold looks out of the window: the day phase and the hearth clock both tick here. */
export const CLOCK_TICK_MS = 60_000;

const WorldContext = createContext<WorldValue | null>(null);

export function useWorld(): WorldValue | null {
  return useContext(WorldContext);
}

export function WorldProvider({ children }: { children: ReactNode }) {
  const segments = useSegments();
  const params = useGlobalSearchParams<{ matchId?: string | string[] }>();
  const matchId = Array.isArray(params.matchId) ? params.matchId[0] : params.matchId;
  const level = useVfxLevel();
  const light = useSharedValue(0);

  // One clock for the whole hold, re-read once a minute. Re-rendering on the tick is what lets a
  // chat left open cool by itself and a dusk arrive without anyone navigating.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);
  const phase = dayPhase(new Date(now));

  const room = WORLD_ENABLED ? roomFor(segments) : null;
  const state = useWorldState(matchId, now);
  // The phase shifts the target before it is animated, so weather and news arrive the same way.
  // Null passes through: the time of day never turns "not loaded" into darkness.
  const target = room ? applyPhase(ROOMS[room].light(state), phase) : null;

  const lastRoom = useRef<RoomName | null>(null);
  useEffect(() => {
    const changedRoom = lastRoom.current !== room;
    lastRoom.current = room;

    // No data is not darkness — a room opens at its base and waits. But holding the *previous*
    // room's brightness across a doorway would light the new room with the old room's news, so a
    // room change with nothing to say resets to base instead of inheriting.
    if (target == null) {
      if (changedRoom) light.value = 0;
      return;
    }
    // Light never eases down just because a query went in flight: `target` is null in that case
    // and we returned above. Reaching here means the value genuinely moved.
    if (!motionAllowed(level) || changedRoom) {
      light.value = target;
      return;
    }
    // Arriving light springs, leaving light fades — see `LIGHT_SPRING`. Read before write: the
    // comparison has to happen against where the room is now, not where it is heading.
    light.value = target > light.value
      ? withSpring(target, LIGHT_SPRING)
      : withTiming(target, { duration: LIGHT_FADE_MS });
  }, [room, target, level]);

  // Depth, not identity, is what the body is told about: descending into a delve thuds, coming
  // back up rises, and crossing between rooms at the same depth says nothing at all.
  const lastDepth = useRef<number | null>(null);
  useEffect(() => {
    // The video call is the one unlit route, and muting there is the same fact as not lighting it:
    // the hold does not speak over a conversation.
    setFeedbackMuted(room == null);
    const depth = room ? ROOMS[room].depth : null;
    const previous = lastDepth.current;
    lastDepth.current = depth;
    if (depth == null || previous == null || depth === previous) return;
    signal(depth > previous ? 'enterDeep' : 'ascend');
  }, [room]);

  return (
    <WorldContext.Provider value={{ room, recipe: room ? LIGHT[ROOMS[room].base] : null, light, phase }}>
      {children}
    </WorldContext.Provider>
  );
}
