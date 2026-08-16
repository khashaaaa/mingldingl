import { render, fireEvent } from '@testing-library/react-native';
import { Share } from 'react-native';
import { InviteAllyCard } from '../InviteAllyCard';

// Overrides only Share.share on the real react-native module — mocking
// react-native's internal file path (react-native/Libraries/Share/Share)
// instead would be brittle across RN versions.
//
// Deliberately NOT `{ ...jest.requireActual('react-native'), Share: ... }`:
// react-native's index.js exports most modules (including Share) as lazy
// `get X() { return require(...) }` accessors, and a `{...actual}` spread
// evaluates every one of those getters immediately to build the new object
// literal. That eagerly triggers the `DevMenu` getter, which calls
// `TurboModuleRegistry.getEnforcing('DevMenu')` and throws outside a real
// native runtime — failing the whole test file before any test body runs.
//
// Also deliberately NOT `RN.Share = { share: jest.fn() }`: since `Share` is
// an accessor-only (getter, no setter) property, plain assignment to it
// silently no-ops, leaving the real Share.share in place. Object.defineProperty
// redefines the property outright instead, which works because the
// original getter is configurable.
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  Object.defineProperty(RN, 'Share', { value: { share: jest.fn() }, configurable: true });
  return RN;
});

describe('InviteAllyCard', () => {
  it('renders the referral code', () => {
    const { getByText } = render(<InviteAllyCard referralCode="FOX392" />);
    expect(getByText('FOX392')).toBeTruthy();
  });

  it('shares an invite message containing the code when pressed', () => {
    const { getAllByText } = render(<InviteAllyCard referralCode="FOX392" />);
    // The card heading and the GameButton's label both render the
    // 'invite_ally_title' copy (one key, two spots), so a plain getByText
    // match is ambiguous — the button is the one rendered last.
    const matches = getAllByText(/Invite an Ally/i);
    fireEvent.press(matches[matches.length - 1]);
    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining('FOX392') }),
    );
  });

  it('renders nothing when no code is available yet', () => {
    const { queryByText } = render(<InviteAllyCard referralCode={null} />);
    expect(queryByText(/Invite an Ally/i)).toBeNull();
  });
});
