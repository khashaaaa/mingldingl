import { ROOMS, isUnlit, matchRoom } from './rooms';

export type TravelAnimation = 'slide_from_bottom' | 'fade' | 'default';

/**
 * Direction encodes depth: going somewhere deeper opens from below, and coming back up rises the
 * ordinary way. Lateral movement inside the hold — a tab switch between rooms at the same depth —
 * stays instant, because walking across a hall is not travel.
 *
 * Stock React Navigation animations only. Shared-element work is the worst effort-to-payoff trade
 * on Android, and the light and sound layers already carry the feeling.
 *
 * @param routeName the navigator's route name, which is already in `matchRoom`'s path form.
 */
export function animationFor(routeName: string, reduceMotion: boolean): TravelAnimation {
  if (reduceMotion) return 'fade';
  if (isUnlit(routeName)) return 'default';
  const room = matchRoom(routeName);
  return room && ROOMS[room].depth === 2 ? 'slide_from_bottom' : 'default';
}
