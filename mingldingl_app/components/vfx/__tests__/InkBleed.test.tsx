import { act, fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { InkBleed } from '../InkBleed';

jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => 'plain',
}));

const shoot = jest.fn(() => Promise.resolve(null));

function layout(getByText: (t: string) => any) {
  // The photographed view is the one that measures the children.
  let node = getByText('reward').parent;
  while (node && !node.props.onLayout) node = node.parent;
  fireEvent(node, 'layout', { nativeEvent: { layout: { width: 200, height: 60 } } });
}

describe('InkBleed', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    shoot.mockClear();
    jest.requireMock<{ makeImageFromView: unknown }>('@shopify/react-native-skia').makeImageFromView = shoot;
  });
  afterEach(() => jest.useRealTimers());

  it('photographs an arrival once it has a size', () => {
    const { getByText } = render(<InkBleed><Text>reward</Text></InkBleed>);
    layout(getByText);
    act(() => { jest.advanceTimersByTime(50); });
    expect(shoot).toHaveBeenCalledTimes(1);
  });

  it('keeps a held arrival unphotographed, and lets its views settle once released', () => {
    // A quest that arrives in a log behind another screen waits to be seen, then is given time
    // for its images to come back before the photograph.
    const tree = (hold: boolean) => <InkBleed hold={hold}><Text>reward</Text></InkBleed>;
    const { getByText, rerender } = render(tree(true));
    layout(getByText);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(shoot).not.toHaveBeenCalled();

    rerender(tree(false));
    act(() => { jest.advanceTimersByTime(60); });
    expect(shoot).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(200); });
    expect(shoot).toHaveBeenCalledTimes(1);
  });

  it('shows the children at once when told not to bleed', () => {
    const { getByText } = render(<InkBleed bleed={false}><Text>reward</Text></InkBleed>);
    layout(getByText);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(shoot).not.toHaveBeenCalled();
  });
});
