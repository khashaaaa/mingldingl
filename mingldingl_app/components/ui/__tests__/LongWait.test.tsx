import { act, render } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { LongWait } from '../LongWait';
import { STAGE_TWO_MS, STAGE_THREE_MS } from '../../../lib/waiting';
import { i18n } from '../../../lib/i18n';
import { ICON_SIZES } from '../../../lib/theme';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

/** The candle is decorative inside the block, so the queries have to say they want it. */
const HIDDEN = { includeHiddenElements: true };

describe('LongWait', () => {
  beforeEach(() => {
    mockLevel = 'plain';
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it('opens with the line that wait already showed', () => {
    const { getByTestId } = render(<LongWait kind="verifySms" />);
    expect(getByTestId('longwait-line').props.children).toBe(i18n.t('verify_sms_waiting'));
  });

  it('advances its line as the wait drags on', () => {
    const { getByTestId } = render(<LongWait kind="verifySms" />);
    act(() => { jest.advanceTimersByTime(STAGE_TWO_MS); });
    expect(getByTestId('longwait-line').props.children).toBe(i18n.t('wait_verify_still'));

    act(() => { jest.advanceTimersByTime(STAGE_THREE_MS - STAGE_TWO_MS); });
    expect(getByTestId('longwait-line').props.children).toBe(i18n.t('wait_verify_long'));
  });

  // The rule most likely to be broken by a later change: reduce-motion silences the scene, never
  // the narration. Without the copy advancing, a still 60-second wait is indistinguishable from
  // a frozen screen.
  it('still advances its narration under reduce-motion', () => {
    mockLevel = 'still';
    const { getByTestId } = render(<LongWait kind="verifySms" />);
    act(() => { jest.advanceTimersByTime(STAGE_THREE_MS); });
    expect(getByTestId('longwait-line').props.children).toBe(i18n.t('wait_verify_long'));
  });

  it('holds the action back until the last stage', () => {
    const { queryByText, getByText } = render(
      <LongWait kind="verifySms" action={<Text>Send it again</Text>} />,
    );
    expect(queryByText('Send it again')).toBeNull();

    act(() => { jest.advanceTimersByTime(STAGE_THREE_MS); });
    expect(getByText('Send it again')).toBeTruthy();
  });

  // The block is the progressbar and reads its own line out, so the candle inside it is
  // decorative — hidden from the screen reader, which is why the queries below say so.
  it('renders the candle at every level, so the wait is never a bare line of text', () => {
    mockLevel = 'still';
    const { getByTestId } = render(<LongWait kind="squareRound" />);
    expect(getByTestId('waiting-candle', HIDDEN)).toBeTruthy();
  });

  // The long wait is the same candle the buttons burn, only bigger — one drawing for waiting,
  // not a lamp here and a candle there.
  it('burns the candle larger than a button would', () => {
    const { getByTestId } = render(<LongWait kind="squareRound" />);
    expect(StyleSheet.flatten(getByTestId('waiting-candle', HIDDEN).props.style).width)
      .toBeGreaterThan(ICON_SIZES.lg);
  });
});
