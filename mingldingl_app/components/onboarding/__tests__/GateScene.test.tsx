import { render } from '@testing-library/react-native';
import { GateScene } from '../GateScene';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  useVfxLevel: () => mockLevel,
  motionAllowed: (level: string) => level === 'full' || level === 'plain',
}));

describe('GateScene', () => {
  beforeEach(() => {
    mockLevel = 'plain';
  });

  it('closed: the gatekeeper is listening', () => {
    const { getByText, queryByTestId } = render(<GateScene state="closed" />);
    expect(getByText('The gatekeeper listens for your word')).toBeTruthy();
    expect(queryByTestId('gate-crossbar')).toBeNull();
  });

  it('opening: the gate opens', () => {
    const { getByText, queryByTestId } = render(<GateScene state="opening" />);
    expect(getByText('The gate opens')).toBeTruthy();
    expect(queryByTestId('gate-crossbar')).toBeNull();
  });

  it('barred: the crossbar drops and the caption says the hour passed', () => {
    const { getByText, getByTestId } = render(<GateScene state="barred" />);
    expect(getByText('The gate is barred — the hour passed')).toBeTruthy();
    expect(getByTestId('gate-crossbar')).toBeTruthy();
  });

  it('renders every state statically under reduce-motion and the kill switch', () => {
    for (const level of ['still', 'off'] as const) {
      mockLevel = level;
      const { getByText, getByTestId, unmount } = render(<GateScene state="barred" />);
      expect(getByText('The gate is barred — the hour passed')).toBeTruthy();
      expect(getByTestId('gate-crossbar')).toBeTruthy();
      unmount();

      const opening = render(<GateScene state="opening" />);
      expect(opening.getByText('The gate opens')).toBeTruthy();
      opening.unmount();
    }
  });

  it('moves from closed to opening without remounting', () => {
    const { getByText, rerender } = render(<GateScene state="closed" />);
    expect(getByText('The gatekeeper listens for your word')).toBeTruthy();
    rerender(<GateScene state="opening" />);
    expect(getByText('The gate opens')).toBeTruthy();
  });
});
