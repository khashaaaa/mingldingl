import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { LongWait } from '../LongWait';
import { STAGE_TWO_MS, STAGE_THREE_MS } from '../../../lib/waiting';
import { i18n } from '../../../lib/i18n';

let mockLevel: 'full' | 'plain' | 'still' | 'off' = 'plain';
jest.mock('../../../lib/vfx', () => ({
  ...jest.requireActual('../../../lib/vfx'),
  useVfxLevel: () => mockLevel,
}));

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

  it('renders the lamp at every level, so the wait is never a bare line of text', () => {
    mockLevel = 'still';
    const { getByTestId } = render(<LongWait kind="squareRound" />);
    expect(getByTestId('longwait-lamp')).toBeTruthy();
  });
});
