import { act, render, screen } from '@testing-library/react-native';
import { Keyboard, StyleSheet, Text } from 'react-native';
import { Scene } from '../Scene';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 24, bottom: 48, left: 0, right: 0 }),
}));

test('with the keyboard up the footer gives back the bottom inset the keys already cover', async () => {
  const handlers: Record<string, () => void> = {};
  jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, fn: () => void) => {
    handlers[event] = fn;
    return { remove: jest.fn() };
  }) as never);
  await render(
    <Scene footer={<Text testID="action">Continue</Text>}>
      <Text>body</Text>
    </Scene>,
  );
  const pad = () => StyleSheet.flatten(screen.getByTestId('action').parent?.props.style).paddingBottom;
  const resting = pad();
  await act(async () => handlers.keyboardDidShow?.());
  expect(pad()).toBeLessThan(resting - 40);
  await act(async () => handlers.keyboardDidHide?.());
  expect(pad()).toBe(resting);
});
