import { fireEvent, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { StyleSheet } from 'react-native';
import { BelongsProvider } from '@/lib/belongs';
import type { ClosedWhy } from '@/lib/gate';
import { REFRESH_KEY, session, signIn } from '@/lib/session';
import ClosedScreen from '../ClosedScreen';

jest.mock('@/lib/feedback', () => ({ feedback: jest.fn() }));

const show = (why: ClosedWhy) =>
  render(
    <BelongsProvider value={{ group: 'closed', why }}>
      <ClosedScreen />
    </BelongsProvider>,
  );

test('each reason shows its own screen', async () => {
  await show('suspended');
  expect(screen.getByRole('header', { name: 'Cast Out' })).toBeTruthy();
  await show('update');
  expect(screen.getByRole('header', { name: 'The hold has changed' })).toBeTruthy();
  await show('maintenance');
  expect(screen.getByRole('header', { name: 'The gate is shut for repairs' })).toBeTruthy();
  expect(screen.queryByRole('button')).toBeNull();
});

test('a deleted character returns to the Gate by signing out, not by navigating', async () => {
  await signIn({
    accessToken: 'a',
    accessExpiresAt: new Date(Date.now() + 900_000).toISOString(),
    refreshToken: 'r',
    accountId: 'acc',
  });
  await show('deleted');
  await fireEvent.press(screen.getByRole('button', { name: 'Return to the Gate' }));
  expect(session.status()).toBe('none');
  expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBeNull();
});

test('the reason sits in the upper third, 200 pt from the top as in every closed frame', async () => {
  await show('update');
  const column = screen.getByTestId('closed-column');
  // Scene adds the status-bar inset (0 here) and its body's 12 pt above the column.
  expect(StyleSheet.flatten(column.props.style)).toMatchObject({ paddingTop: 200 - 12 });
});
