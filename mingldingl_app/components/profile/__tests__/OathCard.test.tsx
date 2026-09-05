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

function renderCard(oath: (typeof OATH_VALUES)[number] | null = null) {
  return render(
    <OathCard
      oath={oath}
      oathProven={false}
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
});
