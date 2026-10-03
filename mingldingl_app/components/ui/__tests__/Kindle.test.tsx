import { act, fireEvent, render } from '@testing-library/react-native';
import { ScrollView, Text } from 'react-native';
import { HEARTH, useKindle } from '../Kindle';
import { signal } from '../../../lib/world/feedback';

jest.mock('../../../lib/world/feedback', () => ({ signal: jest.fn() }));
// A stub stands in for the scene so a test can see where it stands; the drawing itself is
// checked on a device.
jest.mock('../../vfx/scenes', () => {
  const { View } = jest.requireActual('react-native');
  const Stub = () => <View testID="bonfire" />;
  return { SCENES: new Proxy({}, { get: () => Stub }), useRoomScene: () => 'bonfire' };
});
let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

function List({ onRefresh }: { onRefresh: () => unknown }) {
  const kindle = useKindle({ onRefresh, contentContainerStyle: { paddingTop: 12 } });
  return (
    <ScrollView testID="list" {...kindle.scrollProps}>
      {kindle.header}
      <Text>row</Text>
    </ScrollView>
  );
}

const at = (y: number) => ({ nativeEvent: { contentOffset: { x: 0, y } } });

/** A pull: the drag starts, the list scrolls to `y`, and it is let go there. */
function pullTo(list: ReturnType<typeof render>['getByTestId'] extends (id: string) => infer R ? R : never, y: number) {
  fireEvent(list, 'scrollBeginDrag', at(HEARTH));
  fireEvent.scroll(list, at(y));
  fireEvent(list, 'scrollEndDrag', at(y));
}

describe('useKindle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockLevel = 'plain';
    (signal as jest.Mock).mockClear();
  });
  afterEach(() => jest.useRealTimers());

  it('opens on the list, with the hearth scrolled out of sight above it', () => {
    const { getByTestId } = render(<List onRefresh={jest.fn()} />);
    const list = getByTestId('list');

    expect(list.props.contentOffset).toEqual({ x: 0, y: HEARTH });
    expect(list.props.snapToOffsets).toEqual([HEARTH]);
    // Android's overscroll glow is Material's too.
    expect(list.props.overScrollMode).toBe('never');
    // The list's own top padding stays above the list, not above the hearth.
    const hearth = getByTestId('kindle-hearth');
    expect(hearth.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ marginTop: -12, marginBottom: 12 })]));
  });

  it('kindles on a release with the hearth pulled open, and strikes once as it catches', async () => {
    const onRefresh = jest.fn(() => Promise.resolve());
    const { getByTestId, queryByTestId } = render(<List onRefresh={onRefresh} />);
    const list = getByTestId('list');

    pullTo(list, 0);
    await act(async () => { await Promise.resolve(); });

    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(signal).toHaveBeenCalledTimes(1);
    expect(signal).toHaveBeenCalledWith('stoke');
    // No Skia canvas off `full`: the hearth holds the waiting candle instead.
    expect(queryByTestId('waiting-candle')).not.toBeNull();

    // A second pull while it burns does not fetch again.
    pullTo(list, 0);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('lays the bonfire in the hearth on a device that draws vfx', () => {
    mockLevel = 'full';
    const { getByTestId, queryByTestId } = render(<List onRefresh={jest.fn()} />);
    // Nothing is drawn while the hearth is out of sight.
    expect(queryByTestId('bonfire')).toBeNull();

    fireEvent.scroll(getByTestId('list'), at(HEARTH / 2));

    expect(queryByTestId('bonfire')).not.toBeNull();
    expect(queryByTestId('waiting-candle')).toBeNull();
  });

  it('lets a shallow pull fall shut without fetching', () => {
    const onRefresh = jest.fn();
    const { getByTestId } = render(<List onRefresh={onRefresh} />);

    pullTo(getByTestId('list'), HEARTH - 20);
    act(() => { jest.advanceTimersByTime(500); });

    expect(onRefresh).not.toHaveBeenCalled();
    expect(signal).not.toHaveBeenCalled();
  });

  it('can be kindled again once the fire has been let go', async () => {
    const onRefresh = jest.fn(() => Promise.resolve());
    const { getByTestId } = render(<List onRefresh={onRefresh} />);
    const list = getByTestId('list');

    pullTo(list, 0);
    await act(async () => { jest.advanceTimersByTime(3000); await Promise.resolve(); });
    await act(async () => { jest.advanceTimersByTime(3000); });
    fireEvent.scroll(list, at(HEARTH));
    pullTo(list, 0);
    await act(async () => { await Promise.resolve(); });

    expect(onRefresh).toHaveBeenCalledTimes(2);
  });
});
