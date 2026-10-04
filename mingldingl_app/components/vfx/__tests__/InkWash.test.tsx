import { act, fireEvent, render } from '@testing-library/react-native';
import { COVER_MS, InkWash } from '../InkWash';

jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => 'plain',
}));

const HIDDEN = { includeHiddenElements: true };

describe('InkWash', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('holds the screen covered until what it hides has arrived, then draws back', async () => {
    // A fixed hold drew back on the A51 before the chat had mounted, onto the room being left.
    let arrive = () => {};
    const ready = jest.fn(() => new Promise<void>((resolve) => { arrive = resolve; }));
    const onCovered = jest.fn();
    const onDone = jest.fn();
    const { getByTestId } = render(<InkWash mode="pass" onCovered={onCovered} ready={ready} onDone={onDone} />);
    fireEvent(getByTestId('ink-wash', HIDDEN), 'layout', { nativeEvent: { layout: { width: 360, height: 800 } } });

    act(() => { jest.advanceTimersByTime(COVER_MS + 50); });
    expect(onCovered).toHaveBeenCalledTimes(1);
    expect(ready).toHaveBeenCalledTimes(1);

    act(() => { jest.advanceTimersByTime(3000); });
    expect(onDone).not.toHaveBeenCalled();

    await act(async () => { arrive(); });
    act(() => { jest.advanceTimersByTime(3000); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('covers and stays in cover mode, without waiting on anything', () => {
    const onDone = jest.fn();
    const { getByTestId } = render(<InkWash mode="cover" onDone={onDone} />);
    fireEvent(getByTestId('ink-wash', HIDDEN), 'layout', { nativeEvent: { layout: { width: 360, height: 800 } } });
    act(() => { jest.advanceTimersByTime(COVER_MS + 50); });
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
