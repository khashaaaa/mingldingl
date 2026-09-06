import { Platform } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { OathCard } from '../OathCard';
import { OATH_NAME_KEYS, OATH_VALUES } from '../../OathSigil';
import { i18n } from '../../../lib/i18n';

const mockSwear = jest.fn();
let mockIsSwearing = false;
let mockSwearError = false;

jest.mock('../../../hooks/useOath', () => ({
  useSwearOath: () => ({ swear: mockSwear, isSwearing: mockIsSwearing, swearError: mockSwearError }),
}));

function renderCard(oath: (typeof OATH_VALUES)[number] | null = null, oathProven = false) {
  return render(
    <OathCard
      oath={oath}
      oathProven={oathProven}
      encountersHeld={null}
      encountersNeeded={null}
      gemTier="Garnet"
    />,
  );
}

describe('OathCard', () => {
  const realOS = Platform.OS;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsSwearing = false;
    mockSwearError = false;
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  });
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true });
  });

  it('prompts when no oath is sworn yet', () => {
    const { getByText } = renderCard();
    expect(getByText(i18n.t('oath_prompt_banner'))).toBeTruthy();
  });

  it('swears the oath the picker row names', () => {
    const { getByText } = renderCard();

    // CardEyebrow uppercases its label.
    fireEvent.press(getByText(i18n.t('oath_title').toUpperCase()));
    fireEvent.press(getByText(i18n.t(OATH_NAME_KEYS[OATH_VALUES[1]])));

    expect(mockSwear).toHaveBeenCalledWith(OATH_VALUES[1]);
  });

  it('just closes the picker when the current oath is tapped again', () => {
    const current = OATH_VALUES[0];
    const { getAllByText, getByText } = renderCard(current);

    // CardEyebrow uppercases its label.
    fireEvent.press(getByText(i18n.t('oath_title').toUpperCase()));
    // The sworn oath's name is on the card's sigil as well as in the picker; the picker row is last.
    fireEvent.press(getAllByText(i18n.t(OATH_NAME_KEYS[current])).at(-1)!);

    expect(mockSwear).not.toHaveBeenCalled();
  });

  it('does not swear while a swear is already in flight', () => {
    mockIsSwearing = true;
    const { getByText } = renderCard();

    // CardEyebrow uppercases its label.
    fireEvent.press(getByText(i18n.t('oath_title').toUpperCase()));
    fireEvent.press(getByText(i18n.t(OATH_NAME_KEYS[OATH_VALUES[1]])));

    expect(mockSwear).not.toHaveBeenCalled();
  });

  it('surfaces a failed swear as the generic failure alert', () => {
    mockSwearError = true;
    const { getByText } = renderCard();

    expect(getByText(i18n.t('action_failed_title'))).toBeTruthy();
  });

  it('warns before a proven oath is traded away, and does not swear until confirmed', () => {
    // Swearing a different oath clears OathProven and restarts the vow, and the +40 is never paid
    // twice — so an unconfirmed tap here permanently costs the badge.
    const { getAllByText, getByText, queryByText } = renderCard('Bond', true);

    // CardEyebrow uppercases its label.
    fireEvent.press(getByText(i18n.t('oath_title').toUpperCase()));
    // 'Fate' also labels the sigil on the card behind the sheet; the picker row is last.
    fireEvent.press(getAllByText(i18n.t(OATH_NAME_KEYS.Fate)).at(-1)!);

    expect(mockSwear).not.toHaveBeenCalled();
    expect(queryByText(i18n.t('oath_reswear_title'))).toBeTruthy();

    // GameButton uppercases its label.
    fireEvent.press(getByText(i18n.t('oath_reswear_confirm').toUpperCase()));
    expect(mockSwear).toHaveBeenCalledWith('Fate');
  });

  it('lets the warning be backed out of without changing the oath', () => {
    const { getAllByText, getByText } = renderCard('Bond', true);

    // CardEyebrow uppercases its label.
    fireEvent.press(getByText(i18n.t('oath_title').toUpperCase()));
    // 'Fate' also labels the sigil on the card behind the sheet; the picker row is last.
    fireEvent.press(getAllByText(i18n.t(OATH_NAME_KEYS.Fate)).at(-1)!);
    // GameButton uppercases its label.
    fireEvent.press(getByText(i18n.t('alert_cancel').toUpperCase()));

    expect(mockSwear).not.toHaveBeenCalled();
  });

  it('does not warn when there is no proven vow to lose', () => {
    const { getAllByText, getByText } = renderCard('Bond', false);

    // CardEyebrow uppercases its label.
    fireEvent.press(getByText(i18n.t('oath_title').toUpperCase()));
    // 'Fate' also labels the sigil on the card behind the sheet; the picker row is last.
    fireEvent.press(getAllByText(i18n.t(OATH_NAME_KEYS.Fate)).at(-1)!);

    expect(mockSwear).toHaveBeenCalledWith('Fate');
  });
});
