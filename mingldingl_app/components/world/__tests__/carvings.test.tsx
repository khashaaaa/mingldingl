import { render } from '@testing-library/react-native';
import Animated from 'react-native-reanimated';
import { useSegments } from 'expo-router';
import { Carvings, resetCarvingsForTest } from '../Carvings';
import { CARVING_IMAGES, PAINTED_ROOMS } from '../carvingImages';
import { ROOMS, type RoomName } from '../../../lib/world';
import { CARVING, TAB_BAR_HEIGHT } from '../../../lib/theme';

jest.mock('expo-router', () => ({ useSegments: jest.fn(() => []) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 20, left: 0, right: 0 }) }));
const mockSegments = useSegments as jest.Mock;

const light = { value: 1 } as never;
const flat = (style: unknown): Record<string, unknown> =>
  Object.assign({}, ...([style] as unknown[]).flat(Infinity).filter(Boolean));

describe('the rock carvings along the foot of each room', () => {
  beforeEach(() => {
    resetCarvingsForTest();
    mockSegments.mockReturnValue([]);
  });

  it('every room has a frieze — a room added to the table without one is caught here', () => {
    for (const room of Object.keys(ROOMS)) expect(CARVING_IMAGES[room]).toBeTruthy();
  });

  it('the Deep alone is painted in ochre; every other room is pecked pale stone', () => {
    expect(PAINTED_ROOMS).toEqual(['deep']);
    const deep = render(<Carvings room="deep" light={light} />).UNSAFE_getByType(Animated.Image);
    expect(flat(deep.props.style).tintColor).toBe(CARVING.ochre);
    const road = render(<Carvings room="road" light={light} />).UNSAFE_getByType(Animated.Image);
    expect(flat(road.props.style).tintColor).toBe(CARVING.stone);
  });

  it('never intercepts a tap', () => {
    expect(render(<Carvings room="hall" light={light} />).getByTestId('carvings-hall').props.pointerEvents).toBe('none');
  });

  it('stands on the tab bar on a tab screen, and on the bottom inset everywhere else', () => {
    const band = (room: RoomName) => flat(render(<Carvings room={room} light={light} />).getByTestId(`carvings-${room}`).props.style);
    expect(band('hall').bottom).toBe(20);
    mockSegments.mockReturnValue(['(tabs)', 'discover']);
    expect(band('road').bottom).toBe(TAB_BAR_HEIGHT + 20);
  });
});
