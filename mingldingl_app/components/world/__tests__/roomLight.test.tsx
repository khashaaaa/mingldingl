import { render } from '@testing-library/react-native';
import { RoomLight } from '../RoomLight';
import { useWorld } from '../WorldProvider';
import { roadLight, applyPhase, CARD_VIGNETTE } from '../../../lib/world';
import { NIGHT } from '../../../lib/theme';
import type { WorldState } from '../../../lib/world';

jest.mock('../WorldProvider', () => ({ useWorld: jest.fn() }));
const mockWorld = useWorld as jest.Mock;

const EMPTY: WorldState = {
  budget: null, activeMatches: null, tavern: null, delve: null, profile: null, honours: null,
};

/**
 * A room, as `WorldProvider` supplies one. The `edge` matters now: the card takes the room's own
 * night temperature rather than a neutral grey, so a recipe without one lights nothing — which
 * is the behaviour the last two assertions below pin down.
 */
function world(light: number, edge: string | null = NIGHT.plain) {
  return { room: 'road', recipe: { edge, vignette: [0.5, 0.32] }, light: { value: light }, phase: 'day' };
}

describe('the room light on a candidate', () => {
  beforeEach(() => jest.clearAllMocks());

  it('draws nothing where the hold has no room — an unlit route, or the layer switched off', () => {
    mockWorld.mockReturnValue(null);
    expect(render(<RoomLight />).queryByTestId('room-light')).toBeNull();
  });

  it('hangs over the card once a room is lighting it', () => {
    mockWorld.mockReturnValue(world(1));
    expect(render(<RoomLight />).getByTestId('room-light')).toBeTruthy();
  });

  it('never intercepts a tap — the photo underneath still pages', () => {
    mockWorld.mockReturnValue(world(0.5));
    expect(render(<RoomLight />).getByTestId('room-light').props.pointerEvents).toBe('none');
  });

  /**
   * The whole point: the Road's light is the day's match budget, so spending it has to be
   * visible on the card and not only in the margins the canopy paints.
   */
  it('opens on a full budget and closes as the day is spent', () => {
    const full = roadLight({ ...EMPTY, budget: { remaining: 5, budget: 5 } });
    const half = roadLight({ ...EMPTY, budget: { remaining: 2, budget: 5 } });
    const spent = roadLight({ ...EMPTY, budget: { remaining: 0, budget: 5 } });

    expect(full).toBe(1);
    expect(spent).toBe(0);
    expect(half).toBeLessThan(full!);
    expect(half).toBeGreaterThan(spent!);
  });

  /** No budget in the cache is not an empty budget: the room holds rather than going dark. */
  it('holds when the budget has not loaded', () => {
    expect(roadLight(EMPTY)).toBeNull();
    expect(applyPhase(null, 'night')).toBeNull();
  });

  /** A room with no night colour is a room the card cannot be lit by. */
  it('draws nothing when the room has no edge colour', () => {
    mockWorld.mockReturnValue(world(0, null));
    expect(render(<RoomLight />).queryByTestId('room-light')).toBeNull();
  });

  it('is darkest unlit and clear at full light', () => {
    const [dark, lit] = CARD_VIGNETTE;
    expect(dark).toBeGreaterThan(lit);
    expect(lit).toBe(0);
  });
});
