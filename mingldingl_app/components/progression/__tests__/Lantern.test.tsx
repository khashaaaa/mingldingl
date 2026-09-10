import { act, render } from '@testing-library/react-native';
import { Lantern } from '../Lantern';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

describe('Lantern', () => {
  beforeEach(() => {
    mockLevel = 'plain';
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it.each([
    [0, 0],
    [4, 4],
    [7, 7],
    [12, 7],
  ])('lights min(days, 7) flames for %i days', (days, lit) => {
    const { getAllByTestId, queryAllByTestId } = render(<Lantern days={days} />);
    expect(queryAllByTestId('flame-lit')).toHaveLength(lit);
    expect(lit === 7 ? queryAllByTestId('flame-unlit') : getAllByTestId('flame-unlit')).toHaveLength(7 - lit);
  });

  it('counts the dawns toward seven', () => {
    const { getByText } = render(<Lantern days={4} />);
    expect(getByText('4 of 7 dawns')).toBeTruthy();
  });

  it('switches to the burning copy from the seventh dawn on', () => {
    const { getByText, queryByText } = render(<Lantern days={9} />);
    expect(getByText('9 dawns and burning')).toBeTruthy();
    expect(queryByText(/of 7 dawns/)).toBeNull();
  });

  it('blows out the flames that went out, then settles on the new count', () => {
    const { queryAllByTestId, rerender } = render(<Lantern days={6} />);
    expect(queryAllByTestId('flame-lit')).toHaveLength(6);

    rerender(<Lantern days={3} />);
    // The flames going out are still mounted while they gutter.
    expect(queryAllByTestId('flame-lit')).toHaveLength(6);

    // Bounded, not `runAllTimers`: the lit flames keep flickering on a loop that never drains.
    act(() => { jest.advanceTimersByTime(2000); });
    expect(queryAllByTestId('flame-lit')).toHaveLength(3);
    expect(queryAllByTestId('flame-unlit')).toHaveLength(4);
  });

  it('lights new flames at once when the count rises', () => {
    const { queryAllByTestId, rerender } = render(<Lantern days={2} />);
    rerender(<Lantern days={5} />);
    expect(queryAllByTestId('flame-lit')).toHaveLength(5);
  });

  it('switches flames off without a blow-out under still', () => {
    mockLevel = 'still';
    const { queryAllByTestId, rerender } = render(<Lantern days={6} />);
    rerender(<Lantern days={3} />);
    expect(queryAllByTestId('flame-lit')).toHaveLength(3);
  });
});
