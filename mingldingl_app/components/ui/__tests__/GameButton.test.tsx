import { StyleSheet } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GameButton } from '../GameButton';
import { signal } from '../../../lib/world/feedback';

jest.mock('../../../lib/world/feedback', () => ({ signal: jest.fn() }));

const signalMock = signal as jest.Mock;

describe('GameButton', () => {
  beforeEach(() => jest.clearAllMocks());

  it('ticks once on press-in and calls through on press', () => {
    const onPress = jest.fn();
    const { getByText } = render(<GameButton onPress={onPress}>Forge</GameButton>);
    const label = getByText('FORGE');
    fireEvent(label, 'pressIn');
    fireEvent(label, 'pressOut');
    fireEvent.press(label);
    expect(signalMock).toHaveBeenCalledTimes(1);
    expect(signalMock).toHaveBeenCalledWith('press');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says nothing when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<GameButton onPress={onPress} disabled>Forge</GameButton>);
    const label = getByText('FORGE');
    fireEvent(label, 'pressIn');
    fireEvent.press(label);
    expect(signalMock).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('says nothing while loading', () => {
    const { getByRole } = render(<GameButton onPress={() => {}} loading>Forge</GameButton>);
    fireEvent(getByRole('button'), 'pressIn');
    expect(signalMock).not.toHaveBeenCalled();
  });
});

/**
 * The ink variant is the other half of "one forged button per screen": a secondary action has to
 * go somewhere, and the board draws it as an underlined link rather than a second slab. So the
 * things that make a button *forged* — the metal gradient, the top highlight, the shouting caps —
 * must all be absent, while the things that make it a *button* — the touch target, the press
 * signal, loading and disabled — must all survive.
 */
describe('GameButton, inked', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sets the label in sentence case, not the forge’s caps', () => {
    const { getByText, queryByText } = render(
      <GameButton variant="ink" onPress={() => {}}>Let them pass</GameButton>,
    );
    expect(getByText('Let them pass')).toBeTruthy();
    expect(queryByText('LET THEM PASS')).toBeNull();
  });

  it('pours no metal — no gradient, and no slab highlight', () => {
    const forged = render(<GameButton onPress={() => {}}>Forge</GameButton>);
    expect(forged.UNSAFE_queryAllByType(LinearGradient).length).toBe(1);

    const ink = render(<GameButton variant="ink" onPress={() => {}}>Let them pass</GameButton>);
    expect(ink.UNSAFE_queryAllByType(LinearGradient)).toEqual([]);
  });

  it('draws its own hairline underline instead', () => {
    const { getByTestId } = render(
      <GameButton variant="ink" onPress={() => {}}>Let them pass</GameButton>,
    );
    expect(getByTestId('ink-underline')).toBeTruthy();
    expect(
      render(<GameButton onPress={() => {}}>Forge</GameButton>).queryByTestId('ink-underline'),
    ).toBeNull();
  });

  it('keeps the same touch target as the button it replaces', () => {
    const ink = render(<GameButton variant="ink" onPress={() => {}}>Let them pass</GameButton>);
    const forged = render(<GameButton onPress={() => {}}>Forge</GameButton>);
    const minHeight = (r: ReturnType<typeof render>) =>
      StyleSheet.flatten(r.getByRole('button').props.style).minHeight;
    expect(minHeight(ink)).toBe(minHeight(forged));
  });

  it('ticks once on press-in and calls through on press', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <GameButton variant="ink" onPress={onPress}>Let them pass</GameButton>,
    );
    const label = getByText('Let them pass');
    fireEvent(label, 'pressIn');
    fireEvent.press(label);
    expect(signalMock).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('says nothing when disabled', () => {
    const onPress = jest.fn();
    const { getByText, getByRole } = render(
      <GameButton variant="ink" onPress={onPress} disabled>Let them pass</GameButton>,
    );
    fireEvent(getByText('Let them pass'), 'pressIn');
    fireEvent.press(getByText('Let them pass'));
    expect(signalMock).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
    expect(getByRole('button').props.accessibilityState.disabled).toBe(true);
  });

  it('swaps the label for the wait, and cannot be pressed while it waits', () => {
    const onPress = jest.fn();
    const { queryByText, queryByTestId, getByRole } = render(
      <GameButton variant="ink" onPress={onPress} loading>Let them pass</GameButton>,
    );
    expect(queryByText('Let them pass')).toBeNull();
    expect(queryByTestId('ink-underline')).toBeNull();
    fireEvent(getByRole('button'), 'pressIn');
    expect(signalMock).not.toHaveBeenCalled();
    expect(getByRole('button').props.accessibilityState.busy).toBe(true);
  });

  it('takes an icon and a compact size like the metals do', async () => {
    const { findByText, getByRole } = render(
      <GameButton variant="ink" size="compact" icon="chat" flex={1} onPress={() => {}}>
        Let them pass
      </GameButton>,
    );
    // Awaited rather than read synchronously: the icon font loads on a promise, and settling it
    // inside the test keeps its state update from landing after the test has finished.
    expect(await findByText('Let them pass')).toBeTruthy();
    expect(StyleSheet.flatten(getByRole('button').props.style).minHeight).toBe(44);
  });
});
