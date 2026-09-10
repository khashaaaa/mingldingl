import { fireEvent, render, within } from '@testing-library/react-native';
import { HonourCase } from '../HonourCase';
import { HONOUR_DEED_KEYS, HONOUR_ICONS, HONOUR_IDS } from '../../../lib/tiers';
import { i18n } from '../../../lib/i18n';
import { signal } from '../../../lib/world/feedback';

const mockEquip = jest.fn();
const mockItems: { itemId: string; nameKey: string; rarity: string; itemType: string; equipped: boolean; acquiredAt: string }[] = [];
const mockInventory = { items: mockItems, equip: mockEquip, isEquipping: false, isLoading: false };
jest.mock('../../../hooks/useInventory', () => ({
  useInventory: () => mockInventory,
}));
jest.mock('../../../hooks/useMilestones', () => ({
  useMilestones: () => ({ milestones: [], open: jest.fn(), isOpening: false }),
}));
jest.mock('../../../hooks/useOptimisticScoreBump', () => ({ useOptimisticScoreBump: () => jest.fn() }));
const mockScore: { data: Record<string, unknown> | undefined } = { data: undefined };
const mockProfile: { data: Record<string, unknown> | null | undefined } = { data: undefined };
jest.mock('../../../hooks/useScoreDetail', () => ({ useScoreDetail: () => mockScore }));
jest.mock('../../../hooks/useProfile', () => ({ useProfile: () => mockProfile }));
jest.mock('../../modals/ChestModal', () => ({ ChestModal: () => null }));
jest.mock('../../modals/AlertModal', () => ({ AlertModal: () => null }));
jest.mock('../../../lib/world/feedback', () => ({ signal: jest.fn() }));

const oathkeeper = { itemId: 'title_oathkeeper', nameKey: 'item_title_oathkeeper', rarity: 'Ember', itemType: 'Title', equipped: false, acquiredAt: '2026-09-03T10:00:00Z' };
const threadweaver = { itemId: 'title_threadweaver', nameKey: 'item_title_threadweaver', rarity: 'Gold', itemType: 'Title', equipped: false, acquiredAt: '2026-09-03T10:00:00Z' };
const fateseer = { itemId: 'title_fateseer', nameKey: 'item_title_fateseer', rarity: 'Gold', itemType: 'Title', equipped: false, acquiredAt: '2026-09-04T10:00:00Z' };

describe('HonourCase', () => {
  beforeEach(() => {
    i18n.locale = 'en';
    mockEquip.mockClear();
    (signal as jest.Mock).mockClear();
    mockItems.length = 0;
    mockInventory.isLoading = false;
    mockScore.data = undefined;
    mockProfile.data = undefined;
  });

  it('shows all nine honours dark, each with its deed, when nothing has been earned', () => {
    const { getByTestId, getByText } = render(<HonourCase />);
    expect(getByTestId('honour-count').props.children.join('')).toBe('0 / 9');
    for (const id of HONOUR_IDS) expect(getByText(i18n.t(HONOUR_DEED_KEYS[id]))).toBeTruthy();
    expect(getByTestId('honour-title_sevendawns').props.accessibilityState.selected).toBe(false);
    expect(getByText(i18n.t('honours_hint'))).toBeTruthy();
  });

  it('strikes each honour with its own emblem', () => {
    const { getByTestId } = render(<HonourCase />);
    for (const id of HONOUR_IDS) {
      const chip = within(getByTestId(`honour-emblem-${id}`));
      expect(chip.UNSAFE_getAllByProps({ name: HONOUR_ICONS[id] }).length).toBeGreaterThan(0);
    }
  });

  it('lights an earned honour with its date, keeps the rest dark, and lets it be worn', () => {
    mockItems.push(oathkeeper);
    const { getByTestId, getByText, queryByText } = render(<HonourCase />);
    expect(getByTestId('honour-count').props.children.join('')).toBe('1 / 9');
    expect(getByText('Oath-Keeper')).toBeTruthy();
    expect(getByText(i18n.t('honour_deed_flamekeeper'))).toBeTruthy();
    expect(getByText('Sep 3, 2026')).toBeTruthy();
    expect(queryByText(i18n.t('honour_deed_oathkeeper'))).toBeNull();

    fireEvent.press(getByTestId('honour-title_oathkeeper'));
    expect(mockEquip).toHaveBeenCalledWith('title_oathkeeper');
  });

  it('ignores a tap on an honour not yet earned', () => {
    const { getByTestId } = render(<HonourCase />);
    fireEvent.press(getByTestId('honour-title_sealbreaker'));
    expect(mockEquip).not.toHaveBeenCalled();
  });

  it('marks the worn honour from the inventory', () => {
    mockItems.push({ ...oathkeeper, equipped: true });
    const { getByTestId, getByText } = render(<HonourCase />);
    expect(getByTestId('honour-title_oathkeeper').props.accessibilityState.selected).toBe(true);
    expect(getByText(i18n.t('equipped'))).toBeTruthy();
  });

  it('never lists a tier ring', () => {
    mockItems.push({ itemId: 'frame_opal', nameKey: 'item_frame_opal', rarity: 'Gold', itemType: 'Frame', equipped: true, acquiredAt: '2026-09-03T10:00:00Z' });
    const { queryByTestId, getByTestId } = render(<HonourCase />);
    expect(queryByTestId('honour-frame_opal')).toBeNull();
    expect(getByTestId('honour-count').props.children.join('')).toBe('0 / 9');
  });

  it('shows how close a dark Seven Dawns is from the login streak', () => {
    mockScore.data = { currentStreak: 4 };
    const { getByTestId, getByText, queryByTestId } = render(<HonourCase />);
    expect(getByText(i18n.t('honour_progress', { held: 4, needed: 7 }))).toBeTruthy();
    expect(getByTestId('honour-progress-title_sevendawns')).toBeTruthy();
    // Nothing counts toward the Flame Rite, so that slot stays deed-only.
    expect(queryByTestId('honour-progress-title_flamekeeper')).toBeNull();
  });

  it('hides the progress rule once the honour is held', () => {
    mockScore.data = { currentStreak: 7 };
    mockItems.push({ ...oathkeeper, itemId: 'title_sevendawns', nameKey: 'item_title_sevendawns', rarity: 'Gold' });
    const { queryByTestId } = render(<HonourCase />);
    expect(queryByTestId('honour-progress-title_sevendawns')).toBeNull();
  });

  it('opens the story on a long press, held or not, and lets a held one be worn from there', () => {
    mockItems.push(oathkeeper);
    const { getByTestId, getByText, queryByText } = render(<HonourCase />);
    expect(queryByText(i18n.t('honour_lore_sevendawns'))).toBeNull();

    fireEvent(getByTestId('honour-title_sevendawns'), 'longPress');
    const sheet = within(getByTestId('honour-story'));
    expect(sheet.getByText(i18n.t('honour_lore_sevendawns'))).toBeTruthy();
    expect(sheet.getByText(i18n.t('honour_deed_sevendawns'))).toBeTruthy();
    expect(queryByText(i18n.t('honour_wear').toUpperCase())).toBeNull();
    expect(mockEquip).not.toHaveBeenCalled();

    fireEvent(getByTestId('honour-title_oathkeeper'), 'longPress');
    expect(getByText(i18n.t('honour_lore_oathkeeper'))).toBeTruthy();
    fireEvent.press(getByText(i18n.t('honour_wear').toUpperCase()));
    expect(mockEquip).toHaveBeenCalledWith('title_oathkeeper');
  });

  it('offers to take off the honour that is already worn', () => {
    mockItems.push({ ...oathkeeper, equipped: true });
    const { getByTestId, getByText } = render(<HonourCase />);
    fireEvent(getByTestId('honour-title_oathkeeper'), 'longPress');
    expect(getByText(i18n.t('honour_take_off').toUpperCase())).toBeTruthy();
  });

  it('sounds the honour once when a new one arrives while the hall is open, never on arrival', () => {
    mockItems.push(oathkeeper);
    const { rerender } = render(<HonourCase />);
    expect(signal).not.toHaveBeenCalled();

    mockItems.push({ ...oathkeeper, itemId: 'title_trueword', nameKey: 'item_title_trueword', rarity: 'Gold' });
    rerender(<HonourCase />);
    expect(signal).toHaveBeenCalledTimes(1);
    expect(signal).toHaveBeenCalledWith('honour');

    rerender(<HonourCase />);
    expect(signal).toHaveBeenCalledTimes(1);
  });

  it('does not mistake the inventory loading for an empty hall', () => {
    mockInventory.isLoading = true;
    const { rerender } = render(<HonourCase />);
    mockInventory.isLoading = false;
    mockItems.push(oathkeeper);
    rerender(<HonourCase />);
    expect(signal).not.toHaveBeenCalled();
  });

  it('lights the thread between two held neighbours and leaves the rest dim', () => {
    mockItems.push(threadweaver, fateseer);
    const { getByTestId } = render(<HonourCase />);
    expect(getByTestId('honour-triptych')).toBeTruthy();
    expect(getByTestId('honour-thread-title_fateseer').props.accessibilityState.selected).toBe(true);
    expect(getByTestId('honour-thread-title_bondkeeper').props.accessibilityState.selected).toBe(false);
  });
});
