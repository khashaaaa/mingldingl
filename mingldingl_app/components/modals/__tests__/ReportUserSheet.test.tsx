import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { ReportUserSheet } from '../ReportUserSheet';
import { apiClient } from '../../../lib/api/apiClient';
import { i18n } from '../../../lib/i18n';

jest.mock('../../../lib/api/apiClient', () => ({
  apiClient: { reports: { create: jest.fn() } },
}));

const mockCreate = apiClient.reports.create as jest.Mock;

/**
 * The only way to report anyone. Before it existed the score economy carried a `ReportPenalty`
 * delta nothing could ever award, and blocking someone you were already matched with was the only
 * lever a user had.
 */
describe('ReportUserSheet', () => {
  beforeEach(() => jest.clearAllMocks());

  /** GameButton upper-cases its label, so the submit button is not findable by the raw key. */
  const submitButton = (getByText: (t: string) => unknown) =>
    getByText(i18n.t('report_submit').toUpperCase()) as never;

  function open(props: Partial<React.ComponentProps<typeof ReportUserSheet>> = {}) {
    const onClose = jest.fn();
    const onReported = jest.fn();
    const utils = render(
      <ReportUserSheet
        visible
        reportedUserId="u-reported"
        onClose={onClose}
        onReported={onReported}
        {...props}
      />,
    );
    return { onClose, onReported, ...utils };
  }

  it('will not submit until a reason is chosen', () => {
    const { getByText } = open();

    fireEvent.press(submitButton(getByText));

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('sends the chosen reason, the typed details and the match it came from', async () => {
    mockCreate.mockResolvedValue({ id: 'r1', status: 'Pending' });
    const { getByText, getByLabelText, onClose, onReported } = open({ matchId: 'm1' });

    fireEvent.press(getByText(i18n.t('report_reason_harassment')));
    fireEvent.changeText(getByLabelText(i18n.t('report_details_label')), '  kept messaging  ');
    fireEvent.press(submitButton(getByText));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith('u-reported', 'Harassment', 'kept messaging', 'm1'));
    await waitFor(() => expect(onReported).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  /** Town Square partners are strangers: there is no match to cite. */
  it('sends no matchId when the report did not come from a conversation', async () => {
    mockCreate.mockResolvedValue({ id: 'r1', status: 'Pending' });
    const { getByText } = open();

    fireEvent.press(getByText(i18n.t('report_reason_scam')));
    fireEvent.press(submitButton(getByText));

    await waitFor(() =>
      expect(mockCreate).toHaveBeenCalledWith('u-reported', 'Scam', undefined, undefined));
  });

  it('leaves details out entirely when nothing was typed', async () => {
    mockCreate.mockResolvedValue({ id: 'r1', status: 'Pending' });
    const { getByText } = open({ matchId: 'm1' });

    fireEvent.press(getByText(i18n.t('report_reason_other')));
    fireEvent.press(submitButton(getByText));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledWith('u-reported', 'Other', undefined, 'm1'));
  });

  /** A silently dropped report is the worst possible outcome for the person filing it. */
  it('shows the server’s own message when the report is refused', async () => {
    mockCreate.mockRejectedValue({
      isAxiosError: true,
      response: { data: { code: 'report.already_open' } },
    });
    const { getByText, findByText, onReported } = open();

    fireEvent.press(getByText(i18n.t('report_reason_fake_profile')));
    fireEvent.press(submitButton(getByText));

    expect(await findByText(i18n.t('report_failed_title'))).toBeTruthy();
    expect(onReported).not.toHaveBeenCalled();
  });
});
