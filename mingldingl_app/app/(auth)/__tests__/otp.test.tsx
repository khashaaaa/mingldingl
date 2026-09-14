import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Linking } from 'react-native';
import OtpScreen from '../otp';
import { signal } from '../../../lib/world/feedback';

jest.mock('../../../lib/world/feedback', () => ({ signal: jest.fn() }));

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useLocalSearchParams: () => ({
    phone: '88110001',
    verificationId: 'v1',
    smsUri: 'sms:144773?body=123456',
    code: '123456',
    displayInstruction: 'Send 123456 to 144773 from this SIM',
    shortcode: '144773',
    expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
  }),
}));

const mockCheckVerification = jest.fn();
const mockCompleteSignIn = jest.fn();
jest.mock('../../../hooks/useAuth', () => ({
  VERIFICATION_POLL_MS: 3000,
  useAuth: () => ({
    checkVerification: mockCheckVerification,
    completeSignIn: mockCompleteSignIn,
    loading: false,
    error: null,
  }),
}));

describe('OtpScreen — the Gate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckVerification.mockResolvedValue('pending');
    mockCompleteSignIn.mockResolvedValue(true);
  });

  it('keeps the gate closed while the gatekeeper listens', async () => {
    const { getByText, queryByText } = render(<OtpScreen />);
    await waitFor(() => expect(mockCheckVerification).toHaveBeenCalledWith('v1'));
    expect(getByText('The gatekeeper listens for your word')).toBeTruthy();
    expect(queryByText('The gate opens')).toBeNull();
    expect(signal).not.toHaveBeenCalled();
  });

  it('opens the gate and sounds the rising note once the poll says verified', async () => {
    mockCheckVerification.mockResolvedValue('verified');
    const { getByText } = render(<OtpScreen />);

    await waitFor(() => expect(getByText('The gate opens')).toBeTruthy());
    expect(signal).toHaveBeenCalledWith('ascend');
    await waitFor(() => expect(mockCompleteSignIn).toHaveBeenCalledWith('v1', '88110001'));
  });

  it('shuts the gate again when sign-in fails after the word arrived', async () => {
    mockCheckVerification.mockResolvedValue('verified');
    mockCompleteSignIn.mockResolvedValue(false);
    const { getByText } = render(<OtpScreen />);

    await waitFor(() => expect(mockCompleteSignIn).toHaveBeenCalled());
    await waitFor(() => expect(getByText('The gatekeeper listens for your word')).toBeTruthy());
  });

  describe('after the word arrives', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('stops polling for good', async () => {
      mockCheckVerification.mockResolvedValue('verified');
      render(<OtpScreen />);

      await waitFor(() => expect(mockCompleteSignIn).toHaveBeenCalledTimes(1));
      await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });

      expect(mockCheckVerification).toHaveBeenCalledTimes(1);
    });

    // Each poll tick after a failure used to re-run sign-in under a new anonymous identity, and the
    // engine answered every one of them AlreadyClaimed — every 3 seconds, forever.
    it('does not retry a failed sign-in on its own; the retry button does', async () => {
      mockCheckVerification.mockResolvedValue('verified');
      mockCompleteSignIn.mockResolvedValue(false);
      const { findByText } = render(<OtpScreen />);

      await waitFor(() => expect(mockCompleteSignIn).toHaveBeenCalledTimes(1));
      await act(async () => { await jest.advanceTimersByTimeAsync(15_000); });
      expect(mockCompleteSignIn).toHaveBeenCalledTimes(1);

      mockCompleteSignIn.mockResolvedValue(true);
      const retry = await findByText(/^retry$/i);
      await act(async () => { fireEvent.press(retry); });

      expect(mockCompleteSignIn).toHaveBeenCalledTimes(2);
      expect(mockCompleteSignIn).toHaveBeenLastCalledWith('v1', '88110001');
    });
  });

  it('bars the gate once the code expires', async () => {
    mockCheckVerification.mockResolvedValue('expired');
    const { getByText, getByTestId } = render(<OtpScreen />);

    await waitFor(() => expect(getByText('The gate is barred — the hour passed')).toBeTruthy());
    expect(getByTestId('gate-crossbar')).toBeTruthy();
    expect(getByText('That code expired')).toBeTruthy();
    expect(signal).not.toHaveBeenCalledWith('ascend');
  });

  it('sounds the horn after the SMS app opens', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    const { getByText } = render(<OtpScreen />);

    await act(async () => {
      fireEvent.press(getByText('OPEN SMS APP'));
    });

    expect(openURL).toHaveBeenCalledWith('sms:144773?body=123456');
    await waitFor(() => expect(signal).toHaveBeenCalledWith('horn'));
    openURL.mockRestore();
  });

  it('stays silent and explains itself when the SMS app cannot open', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));
    const { getByText } = render(<OtpScreen />);

    await act(async () => {
      fireEvent.press(getByText('OPEN SMS APP'));
    });

    await waitFor(() => expect(getByText(/Could not open your SMS app/)).toBeTruthy());
    expect(signal).not.toHaveBeenCalledWith('horn');
    openURL.mockRestore();
  });
});
