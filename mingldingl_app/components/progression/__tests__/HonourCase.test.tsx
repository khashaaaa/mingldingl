import { fireEvent, render } from '@testing-library/react-native';
import { HonourCase } from '../HonourCase';
import { i18n } from '../../../lib/i18n';

const mockEquip = jest.fn();
const mockItems: { itemId: string; nameKey: string; rarity: string; itemType: string; equipped: boolean }[] = [];
jest.mock('../../../hooks/useInventory', () => ({
  useInventory: () => ({ items: mockItems, equip: mockEquip, isEquipping: false, isLoading: false }),
}));
jest.mock('../../../hooks/useMilestones', () => ({
  useMilestones: () => ({ milestones: [], open: jest.fn(), isOpening: false }),
}));
jest.mock('../../../hooks/useOptimisticScoreBump', () => ({ useOptimisticScoreBump: () => jest.fn() }));
jest.mock('../../modals/ChestModal', () => ({ ChestModal: () => null }));
jest.mock('../../modals/AlertModal', () => ({ AlertModal: () => null }));

describe('HonourCase', () => {
  beforeEach(() => {
    i18n.locale = 'en';
    mockEquip.mockClear();
    mockItems.length = 0;
  });

  it('shows the empty honours copy when nothing has been earned', () => {
    const { getByText } = render(<HonourCase gemTier="Garnet" />);
    expect(getByText(i18n.t('no_honours'))).toBeTruthy();
  });

  it('lists honours and lets one be worn', () => {
    mockItems.push({ itemId: 'title_oathkeeper', nameKey: 'item_title_oathkeeper', rarity: 'Ember', itemType: 'Title', equipped: false });
    const { getByTestId, getByText } = render(<HonourCase gemTier="Garnet" />);
    expect(getByText('Oath-Keeper')).toBeTruthy();
    fireEvent.press(getByTestId('honour-title_oathkeeper'));
    expect(mockEquip).toHaveBeenCalledWith('title_oathkeeper');
  });

  it('shows every tier ring, unlocks only those at or below the current tier', () => {
    const { getByTestId, getAllByText } = render(<HonourCase gemTier="Amethyst" />);
    expect(getByTestId('frame-Garnet').props.accessibilityState.disabled).toBe(false);
    expect(getByTestId('frame-Amethyst').props.accessibilityState.disabled).toBe(false);
    expect(getByTestId('frame-Sapphire').props.accessibilityState.disabled).toBe(true);
    expect(getByTestId('frame-Emerald').props.accessibilityState.disabled).toBe(true);
    expect(getAllByText(/Reached at/)).toHaveLength(3);

    fireEvent.press(getByTestId('frame-Opal'));
    expect(mockEquip).toHaveBeenCalledWith('frame_opal');
    fireEvent.press(getByTestId('frame-Ruby'));
    expect(mockEquip).toHaveBeenCalledTimes(1);
  });

  it('marks the worn ring from the inventory', () => {
    mockItems.push({ itemId: 'frame_opal', nameKey: 'item_frame_opal', rarity: 'Gold', itemType: 'Frame', equipped: true });
    const { getByTestId } = render(<HonourCase gemTier="Opal" />);
    expect(getByTestId('frame-Opal').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('frame-Garnet').props.accessibilityState.selected).toBe(false);
  });
});
