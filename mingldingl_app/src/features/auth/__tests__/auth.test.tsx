import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { ApiError } from '@/lib/api/client';
import { setLocale } from '@/lib/i18n';
import { LOCALE_KEY } from '@/lib/i18n/device';
import { REFRESH_KEY, signOutLocally } from '@/lib/session';
import GateScene from '../GateScene';
import PhoneScreen, { isPhone } from '../PhoneScreen';
import { OFFLINE_RETRY_MS, OPENING_HOLD_MS, verifyKey } from '../useVerification';
import VerifyScreen from '../VerifyScreen';

jest.mock('@/lib/feedback', () => ({ feedback: jest.fn() }));

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  useIsFocused: () => true,
  useFocusEffect: () => {},
  useLocalSearchParams: () => ({ phone: '88581234' }),
}));
const { router } = jest.requireMock('expo-router') as { router: Record<string, jest.Mock> };

jest.mock('@/lib/api/generated/engine', () => ({
  startPhone: jest.fn(),
  checkPhone: jest.fn(),
  completePhone: jest.fn(),
}));
const api = jest.requireMock('@/lib/api/generated/engine') as Record<
  'startPhone' | 'checkPhone' | 'completePhone',
  jest.Mock
>;

const PHONE = '88581234';
const started = (id: string, resendIn = 60_000) => ({
  verificationId: id,
  expiresAt: new Date(Date.now() + 600_000).toISOString(),
  resendAt: new Date(Date.now() + resendIn).toISOString(),
});
const pair = {
  accessToken: 'access-1',
  accessExpiresAt: new Date(Date.now() + 900_000).toISOString(),
  refreshToken: 'refresh-1',
  accountId: 'acc-1',
};

/** Lets the hook's awaited calls settle without moving the clock. */
const settle = () => act(async () => {});
const tick = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });
const type = async (code: string) => {
  await fireEvent.changeText(screen.getByLabelText('The code'), code);
  await settle();
};

beforeEach(async () => {
  jest.useFakeTimers();
  for (const m of [...Object.values(api), ...Object.values(router)]) m.mockReset();
  api.startPhone.mockImplementation(async (req: { resumeVerificationId: string | null }) =>
    started(req.resumeVerificationId ?? 'v-new'),
  );
  api.checkPhone.mockResolvedValue({ state: 'verified' });
  await signOutLocally();
  await SecureStore.deleteItemAsync(verifyKey(PHONE));
});
afterEach(() => {
  jest.useRealTimers();
  setLocale('en');
});

describe('Verify', () => {
  test('resumes the id this number was last given, so no second text is sent', async () => {
    await SecureStore.setItemAsync(verifyKey(PHONE), 'v-old');
    await render(<VerifyScreen />);
    await settle();
    expect(api.startPhone).toHaveBeenCalledWith({
      phone: PHONE,
      resumeVerificationId: 'v-old',
      locale: 'en',
    });
    expect(screen.getByText(/on its way to 8858 1234/)).toBeTruthy();
  });

  test('a first visit starts fresh, in the language on screen, and remembers the id', async () => {
    setLocale('mn');
    await render(<VerifyScreen />);
    await settle();
    expect(api.startPhone).toHaveBeenCalledWith({ phone: PHONE, resumeVerificationId: null, locale: 'mn' });
    expect(await SecureStore.getItemAsync(verifyKey(PHONE))).toBe('v-new');
  });

  test('the sixth digit checks the code, completes, and never navigates by itself', async () => {
    api.completePhone.mockResolvedValue(pair);
    await render(<VerifyScreen />);
    await settle();
    await type('48 29');
    expect(api.checkPhone).not.toHaveBeenCalled();
    await type('482913');
    await settle();
    expect(api.checkPhone).toHaveBeenCalledWith({ verificationId: 'v-new', code: '482913' });
    expect(api.completePhone).toHaveBeenCalledWith(expect.objectContaining({ verificationId: 'v-new' }));
    // The seal breaks on screen first; only then is the session stored and the gate moves.
    expect(screen.getByText('The gate opens')).toBeTruthy();
    expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBeNull();
    await tick(OPENING_HOLD_MS);
    await settle();
    expect(await SecureStore.getItemAsync(REFRESH_KEY)).toBe('refresh-1');
    expect(await SecureStore.getItemAsync(verifyKey(PHONE))).toBeNull();
    for (const m of [router.push, router.replace, router.navigate]) expect(m).not.toHaveBeenCalled();
  });

  test('a wrong code says so and may be typed again', async () => {
    api.checkPhone.mockRejectedValueOnce(new ApiError('rule', 422, 'auth.wrong_code', 'wrong'));
    api.completePhone.mockResolvedValue(pair);
    await render(<VerifyScreen />);
    await settle();
    await type('111111');
    expect(screen.getByText(/not the code we sent/)).toBeTruthy();
    expect(api.completePhone).not.toHaveBeenCalled();
    await type('482913');
    expect(api.completePhone).toHaveBeenCalled();
  });

  test.each(['auth.verification_expired', 'auth.too_many_attempts'])(
    '%s asks for a new code, which starts over without resuming',
    async (code) => {
      api.checkPhone.mockRejectedValueOnce(new ApiError('rule', 410, code, 'gone'));
      await render(<VerifyScreen />);
      await settle();
      await type('482913');
      expect(screen.getByText('That code expired')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Get a new code' }));
      await settle();
      expect(api.startPhone).toHaveBeenLastCalledWith({
        phone: PHONE,
        resumeVerificationId: null,
        locale: 'en',
      });
    },
  );

  test('a code used or too old at completion asks for a new one', async () => {
    api.completePhone.mockRejectedValue(new ApiError('rule', 409, 'auth.already_claimed', 'used'));
    await render(<VerifyScreen />);
    await settle();
    await type('482913');
    expect(screen.getByRole('button', { name: 'Get a new code' })).toBeTruthy();
  });

  test('a new code waits out its minute', async () => {
    await render(<VerifyScreen />);
    await settle();
    expect(screen.getByText('A new code in 60 s')).toBeTruthy();
    await tick(60_000);
    await fireEvent.press(screen.getByRole('link', { name: 'Get a new code' }));
    await settle();
    expect(api.startPhone).toHaveBeenLastCalledWith({
      phone: PHONE,
      resumeVerificationId: null,
      locale: 'en',
    });
  });

  test('a lost connection at start offers to try again', async () => {
    api.startPhone.mockRejectedValueOnce(new ApiError('network', 0, 'network', 'offline'));
    await render(<VerifyScreen />);
    await settle();
    expect(screen.getByText('The road is broken')).toBeTruthy();
    await fireEvent.press(screen.getByRole('link', { name: 'Try again' }));
    await settle();
    expect(screen.getByLabelText('The code')).toBeTruthy();
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
    expect(screen.getByLabelText('The code')).toBeTruthy();
    expect(api.startPhone).toHaveBeenCalledTimes(3);
  });

  test('a rule failure does not retry by itself', async () => {
    api.startPhone.mockRejectedValueOnce(new ApiError('rule', 429, 'auth.too_many_codes', 'slow down'));
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
