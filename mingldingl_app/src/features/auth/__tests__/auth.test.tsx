import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { ApiError } from '@/lib/api/client';
import { setLocale } from '@/lib/i18n';
import { LOCALE_KEY } from '@/lib/i18n/device';
import { REFRESH_KEY, signOutLocally } from '@/lib/session';
import GateScene from '../GateScene';
import PhoneScreen, { isPhone } from '../PhoneScreen';
import { OFFLINE_RETRY_MS, OPENING_HOLD_MS, POLL_MS, verifyKey } from '../useVerification';
import VerifyScreen from '../VerifyScreen';

jest.mock('@/lib/feedback', () => ({ feedback: jest.fn() }));

let mockFocused = true;
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  useIsFocused: () => mockFocused,
  useFocusEffect: () => {},
  useLocalSearchParams: () => ({ phone: '88581234' }),
}));
const { router } = jest.requireMock('expo-router') as { router: Record<string, jest.Mock> };

jest.mock('@/lib/api/generated/engine', () => ({
  startPhone: jest.fn(),
  phoneStatus: jest.fn(),
  completePhone: jest.fn(),
}));
const api = jest.requireMock('@/lib/api/generated/engine') as Record<
  'startPhone' | 'phoneStatus' | 'completePhone',
  jest.Mock
>;

const PHONE = '88581234';
const started = (id: string) => ({
  verificationId: id,
  code: '482913',
  displayInstruction: 'Энэ кодыг 144773 руу илгээнэ үү',
  smsUri: 'sms:144773?body=482913',
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
});
const pair = {
  accessToken: 'access-1',
  accessExpiresAt: new Date(Date.now() + 900_000).toISOString(),
  refreshToken: 'refresh-1',
  accountId: 'acc-1',
};

/** Lets the hook's awaited calls settle without moving the poll clock. */
const settle = () => act(async () => {});
const tick = (ms = POLL_MS) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

beforeEach(async () => {
  jest.useFakeTimers();
  mockFocused = true;
  for (const m of [...Object.values(api), ...Object.values(router)]) m.mockReset();
  api.startPhone.mockImplementation(async (req: { resumeVerificationId: string | null }) =>
    started(req.resumeVerificationId ?? 'v-new'),
  );
  api.phoneStatus.mockResolvedValue({ state: 'pending' });
  await signOutLocally();
  await SecureStore.deleteItemAsync(verifyKey(PHONE));
});
afterEach(() => {
  jest.useRealTimers();
  setLocale('en');
});

describe('Verify', () => {
  test('resumes the id this number was last given, so no second text is paid for', async () => {
    await SecureStore.setItemAsync(verifyKey(PHONE), 'v-old');
    await render(<VerifyScreen />);
    await settle();
    expect(api.startPhone).toHaveBeenCalledWith({ phone: PHONE, resumeVerificationId: 'v-old' });
    expect(screen.getByText('482 913')).toBeTruthy();
    expect(screen.getByText('Энэ кодыг 144773 руу илгээнэ үү')).toBeTruthy();
  });

  test('a first visit starts fresh and remembers the id', async () => {
    await render(<VerifyScreen />);
    await settle();
    expect(api.startPhone).toHaveBeenCalledWith({ phone: PHONE, resumeVerificationId: null });
    expect(await SecureStore.getItemAsync(verifyKey(PHONE))).toBe('v-new');
  });

  test('expired shows the new-code action, which starts over without resuming', async () => {
    await SecureStore.setItemAsync(verifyKey(PHONE), 'v-old');
    api.phoneStatus.mockResolvedValue({ state: 'expired' });
    await render(<VerifyScreen />);
    await settle();
    await tick();
    expect(screen.getByText('That code expired')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Get a new code' }));
    await settle();
    expect(api.startPhone).toHaveBeenLastCalledWith({ phone: PHONE, resumeVerificationId: null });
  });

  test('polls every 3 s while focused and stops when it is not', async () => {
    const { rerender } = await render(<VerifyScreen />);
    await settle();
    await tick();
    await tick();
    expect(api.phoneStatus).toHaveBeenCalledTimes(2);
    mockFocused = false;
    await rerender(<VerifyScreen />);
    await tick(POLL_MS * 5);
    expect(api.phoneStatus).toHaveBeenCalledTimes(2);
  });

  test('verified completes, stores the refresh token and never navigates by itself', async () => {
    api.phoneStatus.mockResolvedValue({ state: 'verified' });
    api.completePhone.mockResolvedValue(pair);
    await render(<VerifyScreen />);
    await settle();
    await tick();
    await settle();
    expect(api.completePhone).toHaveBeenCalledWith(expect.objectContaining({ verificationId: 'v-new' }));
    // The seal breaks on screen first; only then is the session stored and the gate moves.
    expect(screen.getByText('The gate opens')).toBeTruthy();
    expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBeNull();
    await tick(OPENING_HOLD_MS);
    await settle();
    expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBe('refresh-1');
    expect(await SecureStore.getItemAsync(verifyKey(PHONE))).toBeNull();
    expect(screen.getByText('The gate opens')).toBeTruthy();
    for (const m of [router.push, router.replace, router.navigate]) expect(m).not.toHaveBeenCalled();
  });

  test('a code used or too old at completion asks for a new one', async () => {
    api.phoneStatus.mockResolvedValue({ state: 'verified' });
    api.completePhone.mockRejectedValue(new ApiError('rule', 409, 'auth.already_claimed', 'used'));
    await render(<VerifyScreen />);
    await settle();
    await tick();
    await settle();
    expect(screen.getByRole('button', { name: 'Get a new code' })).toBeTruthy();
  });

  test('a lost connection at start offers to try again', async () => {
    api.startPhone.mockRejectedValueOnce(new ApiError('network', 0, 'network', 'offline'));
    await render(<VerifyScreen />);
    await settle();
    expect(screen.getByText('The road is broken')).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Try again' }));
    await settle();
    expect(screen.getByText('482 913')).toBeTruthy();
  });

  test('a broken road carries on by itself once the connection returns', async () => {
    api.startPhone
      .mockRejectedValueOnce(new ApiError('network', 0, 'network', 'offline'))
      .mockRejectedValueOnce(new ApiError('network', 0, 'network', 'offline'));
    await render(<VerifyScreen />);
    await settle();
    await tick(OFFLINE_RETRY_MS);
    await settle();
    // Still offline: the screen stays put instead of flashing back to the candle.
    expect(screen.getByText('The road is broken')).toBeTruthy();
    await tick(OFFLINE_RETRY_MS);
    await settle();
    expect(screen.getByText('482 913')).toBeTruthy();
    expect(api.startPhone).toHaveBeenCalledTimes(3);
  });

  test('a rule failure does not retry by itself', async () => {
    api.startPhone.mockRejectedValueOnce(new ApiError('rule', 429, 'auth.too_many', 'slow down'));
    await render(<VerifyScreen />);
    await settle();
    await tick(OFFLINE_RETRY_MS * 3);
    await settle();
    expect(api.startPhone).toHaveBeenCalledTimes(1);
  });
});

describe('Phone', () => {
  test('eight digits go on to Verify; anything else says why', async () => {
    expect(isPhone('88581234')).toBe(true);
    expect(isPhone('8858123')).toBe(false);
    await render(<PhoneScreen />);
    const field = screen.getByLabelText('Phone number');
    await fireEvent.changeText(field, '8858 12');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter your 8-digit number')).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    await fireEvent.changeText(field, '8858-1234');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/verify', params: { phone: PHONE } });
  });
});

describe('Gate', () => {
  test('the language choice switches at once and is kept on the device', async () => {
    await render(<GateScene />);
    await fireEvent.press(screen.getByRole('button', { name: 'Монгол хэл' }));
    await settle();
    expect(await SecureStore.getItemAsync(LOCALE_KEY)).toBe('mn');
    expect(screen.getByRole('button', { name: 'English' })).toBeTruthy();
  });
});
