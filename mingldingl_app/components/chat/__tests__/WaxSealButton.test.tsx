import { render, fireEvent } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { WaxSealButton } from '../WaxSealButton';

// Exercises the real `signal('press')` path (as `lib/world/__tests__/feedback.test.ts` does)
// rather than mocking `lib/world/feedback`, so the assertion is on the haptic actually firing.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Soft: 'soft', Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

describe('WaxSealButton', () => {
  it('is a labelled button that ticks and fires, and is inert when disabled', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(<WaxSealButton onPress={onPress} />);
    fireEvent(getByLabelText('Seal and send'), 'pressIn');
    fireEvent.press(getByLabelText('Seal and send'));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(Haptics.impactAsync).toHaveBeenCalled();

    const off = render(<WaxSealButton onPress={onPress} disabled />);
    expect(off.getByLabelText('Seal and send').props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });
});
