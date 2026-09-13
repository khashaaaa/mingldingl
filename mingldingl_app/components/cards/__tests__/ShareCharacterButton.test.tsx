import { Image } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { ShareCharacterButton } from '../ShareCharacterButton';

// The real module reaches for a native screenshot API that does not exist under jest. `capture`
// resolves to a fixed uri, standing in for the PNG `ViewShot` would actually produce on device.
jest.mock('react-native-view-shot', () => {
  const React = require('react');
  const { View } = require('react-native');
  const capture = jest.fn(() => Promise.resolve('file://captured-card.png'));
  const ViewShot = React.forwardRef((props: { children?: React.ReactNode }, ref: React.Ref<{ capture: () => Promise<string> }>) => {
    React.useImperativeHandle(ref, () => ({ capture }));
    return React.createElement(View, null, props.children);
  });
  return { __esModule: true, default: ViewShot, __capture: capture };
});

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

const PROPS = {
  displayName: 'Erdenebat',
  photoUrl: 'https://x/me.jpg',
  gemTier: 'Ruby' as const,
  totalScore: 1234,
  currentStreak: 3,
  oath: 'Bond' as const,
  oathProven: true,
};

function renderButton(overrides: Partial<typeof PROPS> = {}) {
  return render(<ShareCharacterButton {...PROPS} {...overrides} />);
}

describe('ShareCharacterButton, the keepsake preview', () => {
  beforeEach(() => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Sharing.shareAsync as jest.Mock).mockReset().mockResolvedValue(undefined);
  });

  it('opens the preview on the trigger, showing the poster and its oath eyebrow', () => {
    const { queryByText, getByText, getAllByText } = renderButton();
    expect(queryByText('Your keepsake')).toBeNull();

    fireEvent.press(getByText('Share Character'));

    expect(getByText('Your keepsake')).toBeTruthy();
    expect(getAllByText('Wanted').length).toBeGreaterThan(0);
    expect(getAllByText(/FOR A BOND, HONESTLY KEPT/).length).toBeGreaterThan(0);
  });

  it('captures the card and posts it through Sharing when Post it is pressed', async () => {
    const { getByText, queryByText } = renderButton();
    fireEvent.press(getByText('Share Character'));
    // The forged button uppercases its label — see GameButton's own metal-variant rule.
    fireEvent.press(getByText('POST IT'));

    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith('file://captured-card.png'));
    // A successful post is the one thing that closes the preview on its own.
    await waitFor(() => expect(queryByText('Your keepsake')).toBeNull());
  });

  it('closes the preview on Keep it without sharing anything', () => {
    const { getByText, queryByText } = renderButton();
    fireEvent.press(getByText('Share Character'));
    fireEvent.press(getByText('Keep it'));

    expect(queryByText('Your keepsake')).toBeNull();
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it('keeps the preview open and shows the error on a failed share', async () => {
    (Sharing.shareAsync as jest.Mock).mockRejectedValueOnce(new Error('network'));
    const { getByText, findByText } = renderButton();
    fireEvent.press(getByText('Share Character'));
    fireEvent.press(getByText('POST IT'));

    expect(await findByText("Couldn't create your card — try again")).toBeTruthy();
    expect(getByText('Your keepsake')).toBeTruthy();
  });

  it('does not carry a failed share\'s error into the next time the preview opens', async () => {
    (Sharing.shareAsync as jest.Mock).mockRejectedValueOnce(new Error('network'));
    const { getByText, findByText, queryByText } = renderButton();
    fireEvent.press(getByText('Share Character'));
    fireEvent.press(getByText('POST IT'));
    expect(await findByText("Couldn't create your card — try again")).toBeTruthy();

    // Close on the error, then reopen — a stale error from the last attempt must not follow it.
    fireEvent.press(getByText('Keep it'));
    fireEvent.press(getByText('Share Character'));

    expect(queryByText("Couldn't create your card — try again")).toBeNull();
  });

  it('renders only the sharer\'s own photoUrl as an Image uri, off-screen and in the preview', () => {
    const { getByText, UNSAFE_getAllByType } = renderButton();
    fireEvent.press(getByText('Share Character'));

    const uris = UNSAFE_getAllByType(Image)
      .map((img) => img.props.source?.uri)
      .filter(Boolean);
    expect(uris).toEqual(['https://x/me.jpg', 'https://x/me.jpg']);
  });
});
