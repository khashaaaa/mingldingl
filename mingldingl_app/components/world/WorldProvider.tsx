import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';
import { useGlobalSearchParams, useSegments } from 'expo-router';
import { useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';
import { LIGHT, LIGHT_FADE_MS, ROOMS, WORLD_ENABLED, roomFor, type LightRecipe, type RoomName } from '../../lib/world';
import { useWorldState } from '../../hooks/useWorldState';
import { setFeedbackMuted, signal } from '../../lib/world/feedback';
import { useVfxLevel } from '../../lib/vfx';

interface WorldValue {
  /** null while the route is deliberately unlit, or the whole layer is switched off. */
  room: RoomName | null;
  recipe: LightRecipe | null;
  /** 0..1. Read by the floor and the canopy; never re-renders a screen. */
  light: SharedValue<number>;
}

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

  const room = WORLD_ENABLED ? roomFor(segments) : null;
  const state = useWorldState(matchId);
  const target = room ? ROOMS[room].light(state) : null;

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
    if (level === 'full' && !changedRoom) light.value = withTiming(target, { duration: LIGHT_FADE_MS });
    else light.value = target;
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
    <WorldContext.Provider value={{ room, recipe: room ? LIGHT[ROOMS[room].base] : null, light }}>
      {children}
    </WorldContext.Provider>
  );
}
