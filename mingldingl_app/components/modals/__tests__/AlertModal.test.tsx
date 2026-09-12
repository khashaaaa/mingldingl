import { Platform, StyleSheet, Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { AlertModal } from '../AlertModal';
import { SCRIM, SPACE, overlay } from '../../../lib/theme';
import { useAndroidKeyboardHeight } from '../../../hooks/useAndroidKeyboardHeight';

jest.mock('../../../hooks/useAndroidKeyboardHeight', () => ({
  useAndroidKeyboardHeight: jest.fn(() => 0),
}));

const mockKeyboardHeight = useAndroidKeyboardHeight as jest.Mock;

/**
 * The reckoning, the warning, the faltering — every question and every failure in the app comes
 * through this one component. The kit moved it from a floating card to a bottom parchment strip,
 * with no scrim dimming the room behind it (a ceremony takes the room; a question does not).
 */
describe('AlertModal', () => {
  it('renders without a full-screen scrim over the room', () => {
    const { getByTestId } = render(
      <AlertModal visible title="A question" message="Something to decide." onDismiss={() => {}} />,
    );
    const scrim = getByTestId('dialog-scrim');
    const flat = StyleSheet.flatten(scrim.props.style);
    expect(flat.backgroundColor).not.toBe(overlay(SCRIM.dialog));
    expect(flat.backgroundColor).not.toBe(overlay(SCRIM.ceremony));
    expect(flat.backgroundColor).toBe('transparent');
  });

  it('renders the strip surface', () => {
    const { getByTestId } = render(
      <AlertModal visible title="A question" onDismiss={() => {}} />,
    );
    expect(getByTestId('dialog-strip')).toBeTruthy();
  });

  it('shows the title and message', () => {
    const { getByText } = render(
      <AlertModal visible title="A question" message="Something to decide." onDismiss={() => {}} />,
    );
    expect(getByText('A question')).toBeTruthy();
    expect(getByText('Something to decide.')).toBeTruthy();
  });

  it('fires onDismiss for a plain alert', () => {
    const onDismiss = jest.fn();
    const { getByText } = render(
      <AlertModal visible title="Noted" onDismiss={onDismiss} />,
    );
    // GameButton upper-cases a forged/metal label, so the primary dismiss reads in caps.
    fireEvent.press(getByText('UNDERSTOOD'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('fires onConfirm and onDismiss (cancel) separately when both are given', () => {
    const onDismiss = jest.fn();
    const onConfirm = jest.fn();
    const { getByText } = render(
      <AlertModal visible title="Sever this bond?" onDismiss={onDismiss} onConfirm={onConfirm} confirmLabel="Sever" />,
    );
    fireEvent.press(getByText('CANCEL'));
    expect(onDismiss).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText('SEVER'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('locks both buttons while isConfirming, so a cancel cannot race the request', () => {
    const onDismiss = jest.fn();
    const onConfirm = jest.fn();
    const { getByText, UNSAFE_getByType } = render(
      <AlertModal
        visible title="Sever this bond?" onDismiss={onDismiss} onConfirm={onConfirm}
        confirmLabel="Sever" isConfirming
      />,
    );
    fireEvent.press(getByText('CANCEL'));
    expect(onDismiss).not.toHaveBeenCalled();

    // Hardware back is the other way to dismiss; it must be locked the same way.
    const modal = UNSAFE_getByType(require('react-native').Modal);
    modal.props.onRequestClose();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  /**
   * The kit forges one button per surface, and a strip that carries its own content carries its
   * own deed with it — `PhoneChangeModal` puts "open the SMS app" inside this component. Forging
   * the dismiss as well would put two gold slabs on one strip and rank the way out above the
   * thing the strip is for, so a strip with children demotes its lone dismiss to ink.
   */
  describe('the lone dismiss', () => {
    it('stays forged when the strip is only a title and a message', () => {
      const { getByText, queryByTestId } = render(
        <AlertModal visible title="Noted" onDismiss={() => {}} />,
      );
      // Metal upper-cases its label; ink does not, and draws a hairline under it instead.
      expect(getByText('UNDERSTOOD')).toBeTruthy();
      expect(queryByTestId('ink-underline')).toBeNull();
    });

    it('becomes ink when the strip carries children of its own', () => {
      const { getByText, queryByText, getByTestId } = render(
        <AlertModal visible title="Change my number" onDismiss={() => {}}>
          <Text>The deed lives here.</Text>
        </AlertModal>,
      );
      expect(queryByText('UNDERSTOOD')).toBeNull();
      expect(getByText('Understood')).toBeTruthy();
      expect(getByTestId('ink-underline')).toBeTruthy();
    });

    it('is still the cancel half of a two-button question, children or not', () => {
      // A confirm pair is a different shape: the forged (or danger) slab is the confirm, and the
      // cancel beside it was never the forged one, so children change nothing here.
      const onDismiss = jest.fn();
      const { getByText } = render(
        <AlertModal visible title="Sever this bond?" onDismiss={onDismiss} onConfirm={() => {}} confirmLabel="Sever">
          <Text>The deed lives here.</Text>
        </AlertModal>,
      );
      fireEvent.press(getByText('CANCEL'));
      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(getByText('SEVER')).toBeTruthy();
    });
  });

  it('renders nothing when not visible', () => {
    const { queryByText } = render(
      <AlertModal visible={false} title="Hidden" onDismiss={() => {}} />,
    );
    expect(queryByText('Hidden')).toBeNull();
  });

  /**
   * A strip pinned to the bottom edge sits exactly where the keyboard rises — the phone number
   * field in `PhoneChangeModal` renders inside this very component. `KeyboardAvoidingView` is not
   * trusted on Android under edge-to-edge (see `useAndroidKeyboardHeight`'s own header), so the
   * strip pads by the hook's measured height instead, the same way the chat composer does.
   */
  describe('keyboard clearance', () => {
    const realOS = Platform.OS;
    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true });
      mockKeyboardHeight.mockReturnValue(0);
    });

    it('pads the strip by the measured Android keyboard height', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      mockKeyboardHeight.mockReturnValue(300);

      const { getByTestId } = render(
        <AlertModal visible title="A question" onDismiss={() => {}} />,
      );
      const flat = StyleSheet.flatten(getByTestId('dialog-strip').props.style);
      expect(flat.paddingBottom - SPACE.xl).toBe(300);
    });

    it('adds no offset when the keyboard is not showing', () => {
      Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
      mockKeyboardHeight.mockReturnValue(0);

      const { getByTestId } = render(
        <AlertModal visible title="A question" onDismiss={() => {}} />,
      );
      const flat = StyleSheet.flatten(getByTestId('dialog-strip').props.style);
      expect(flat.paddingBottom - SPACE.xl).toBe(0);
    });
  });
});
