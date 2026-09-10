import { render, fireEvent, act } from '@testing-library/react-native';
import { TierUpCeremony } from '../TierUpCeremony';
import { useVfxLevel } from '../../../lib/vfx';

// The badges and the burst draw through Skia and reanimated; the ceremony's own job is the
// sequence and the words, so the stones are stubs that only report which tier they were given.
jest.mock('../../progression/GemTierBadge', () => {
  const { Text } = require('react-native');
  return { GemTierBadge: ({ tier }: { tier: string }) => <Text>{`badge:${tier}`}</Text> };
});
jest.mock('../../vfx/ChestBurst', () => {
  const { Text } = require('react-native');
  return { ChestBurst: ({ trigger }: { trigger: number }) => (trigger > 0 ? <Text>burst</Text> : null) };
});
jest.mock('../../vfx/TorchGlow', () => ({ TorchGlow: ({ children }: { children: React.ReactNode }) => children }));
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: jest.fn(() => 'plain'),
}));

const mockLevel = useVfxLevel as jest.Mock;

/** Long enough for shake, shed, spring and rise to all settle. */
const WHOLE_CEREMONY_MS = 5000;

describe('TierUpCeremony', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockLevel.mockReturnValue('plain');
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows the stone being shed and the stone being forged, named', () => {
    const { getByText } = render(
      <TierUpCeremony visible tier="Opal" previousTier="Garnet" onDismiss={jest.fn()} />,
    );
    expect(getByText('badge:Garnet')).toBeTruthy();
    expect(getByText('badge:Opal')).toBeTruthy();
    expect(getByText('Ascended to Opal!')).toBeTruthy();
  });

  it('runs the whole sequence — burst fires, then the bounty can be taken', () => {
    const { queryByText, getByText } = render(
      <TierUpCeremony visible tier="Sapphire" previousTier="Amethyst" onDismiss={jest.fn()} />,
    );
    // Nothing to take until the stone is forged.
    expect(queryByText('CONTINUE →')).toBeNull();
    expect(queryByText('burst')).toBeNull();

    act(() => { jest.advanceTimersByTime(WHOLE_CEREMONY_MS); });

    expect(getByText('burst')).toBeTruthy();
    expect(getByText('CONTINUE →')).toBeTruthy();
  });

  it('dismisses through the button', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <TierUpCeremony visible tier="Ruby" previousTier="Sapphire" onDismiss={onDismiss} />,
    );
    act(() => { jest.advanceTimersByTime(WHOLE_CEREMONY_MS); });
    fireEvent.press(getByText('CONTINUE →'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('skips straight to the reveal when motion is not allowed', () => {
    mockLevel.mockReturnValue('still');
    const { getByText, queryByText } = render(
      <TierUpCeremony visible tier="Emerald" previousTier="Ruby" onDismiss={jest.fn()} />,
    );
    // No timers advanced: the button is there on the first frame, and no burst was thrown.
    expect(getByText('CONTINUE →')).toBeTruthy();
    expect(queryByText('burst')).toBeNull();
  });

  it('renders nothing while hidden', () => {
    const { queryByText } = render(
      <TierUpCeremony visible={false} tier="Opal" previousTier="Garnet" onDismiss={jest.fn()} />,
    );
    expect(queryByText('badge:Opal')).toBeNull();
  });
});
