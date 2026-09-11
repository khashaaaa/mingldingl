import { CARD_VIGNETTE, CARD_VIGNETTE_STOPS } from '../../lib/world';
import { Vignette } from './Vignette';

/**
 * The room's light, falling on the thing in the middle of it.
 *
 * `WorldCanopy` already closes a vignette as a room darkens, but its gradient is transparent from
 * 30% to 68% of the screen — precisely the band a candidate card occupies. So the Road could
 * spend an entire day's match budget going out and the only thing that ever changed was the
 * margins. The light knew; the screen did not show it.
 *
 * This puts the same falloff on the card itself, off the same `light` shared value and now
 * through the same `Vignette`, so the first traveller of the day arrives in an open room and the
 * last arrives by torchlight. It is the daily budget, drawn as light instead of printed as a
 * counter — and it is the room's own colour, because it is the same component.
 *
 * Edges only, and never the middle: the card is a photograph of a person the reader is being
 * asked to choose, and a design idea does not get to make that harder.
 */
export function RoomLight() {
  return <Vignette testID="room-light" range={CARD_VIGNETTE} locations={CARD_VIGNETTE_STOPS} />;
}
