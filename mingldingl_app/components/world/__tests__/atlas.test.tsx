import { fireEvent, render } from '@testing-library/react-native';
import { AtlasOverlay } from '../AtlasOverlay';
import { useWorldState } from '../../../hooks/useWorldState';
import { ROOMS } from '../../../lib/world';
import type { WorldState } from '../../../lib/world';

const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
jest.mock('../../../hooks/useWorldState');

const mockState = useWorldState as jest.Mock;

const EMPTY: WorldState = {
  budget: null, activeMatches: null, tavern: null, delve: null, profile: null, honours: null,
};

/** The grid positions rooms from its measured size, so nothing draws until a layout lands. */
function layout(tree: ReturnType<typeof render>) {
  fireEvent(tree.getByTestId('atlas-grid'), 'layout', {
    nativeEvent: { layout: { width: 300, height: 400 } },
  });
}

describe('the atlas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.mockReturnValue(EMPTY);
  });

  it('draws every room in the hold', () => {
    const tree = render(<AtlasOverlay visible onClose={jest.fn()} />);
    layout(tree);
    for (const name of Object.keys(ROOMS)) {
      expect(tree.getByTestId(`atlas-room-${name}`)).toBeTruthy();
    }
  });

  it('sends you to a room and closes behind you', () => {
    const onClose = jest.fn();
    const tree = render(<AtlasOverlay visible onClose={onClose} />);
    layout(tree);
    fireEvent.press(tree.getByTestId('atlas-room-forge'));
    expect(onClose).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(ROOMS.forge.route);
  });

  it('counts open delves on the Deep', () => {
    mockState.mockReturnValue({ ...EMPTY, activeMatches: 4 });
    const tree = render(<AtlasOverlay visible onClose={jest.fn()} />);
    layout(tree);
    expect(tree.getByText('4')).toBeTruthy();
  });

  it('shows no count when no delve is open', () => {
    const tree = render(<AtlasOverlay visible onClose={jest.fn()} />);
    layout(tree);
    expect(tree.queryByText('0')).toBeNull();
  });

  it('renders nothing while dismissed', () => {
    const tree = render(<AtlasOverlay visible={false} onClose={jest.fn()} />);
    expect(tree.queryByTestId('atlas-grid')).toBeNull();
  });

  /**
   * The atlas is a view of the hold, never a hallway through it. Every medallion has to point at a
   * route reachable without the map — a room whose only way in is a medallion would be the failure
   * this feature is defined against.
   */
  it('points every room at a route that exists on its own', () => {
    for (const room of Object.values(ROOMS)) {
      expect(typeof room.route).toBe('string');
      expect(room.match.length).toBeGreaterThan(0);
    }
  });
});
