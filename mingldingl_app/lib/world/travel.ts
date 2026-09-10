import { ROOMS, isUnlit, matchRoom } from './rooms';

export type TravelAnimation = 'slide_from_bottom' | 'fade' | 'none' | 'default';

/**
 * Direction encodes depth: going somewhere deeper opens from below, and coming back up rises the
 * ordinary way. Lateral movement inside the hold — a push between rooms at the same depth — is a
 * cut, because walking across a hall is not travel.
 *
 * Any of these only works because every stack screen stands on its own opaque ground
 * (`ScreenGround` in `app/_layout.tsx`). While screens were transparent over one shared floor,
 * every animation drew the outgoing and incoming screens through each other for the whole
 * hand-over, and even a cut kept a frame of both.
 *
 * Stock React Navigation animations only. Shared-element work is the worst effort-to-payoff trade
 * on Android, and the light and sound layers already carry the feeling.
 *
 * @param routeName the navigator's route name, which is already in `matchRoom`'s path form.
 */
export function animationFor(routeName: string, reduceMotion: boolean): TravelAnimation {
  if (isUnlit(routeName)) return 'default';
  if (reduceMotion) return 'fade';
  const room = matchRoom(routeName);
  return room && ROOMS[room].depth === 2 ? 'slide_from_bottom' : 'none';
}
