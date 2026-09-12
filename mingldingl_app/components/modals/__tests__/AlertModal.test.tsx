import { Platform, StyleSheet } from 'react-native';
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
