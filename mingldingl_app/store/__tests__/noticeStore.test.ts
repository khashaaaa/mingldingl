import { showNotice, useNoticeStore } from '../noticeStore';

describe('noticeStore', () => {
  beforeEach(() => useNoticeStore.setState({ notice: null }));

  it('shows a notice and dismisses it', () => {
    showNotice('Could not load', 'Try again.');
    expect(useNoticeStore.getState().notice).toEqual({ title: 'Could not load', message: 'Try again.' });
    useNoticeStore.getState().dismiss();
    expect(useNoticeStore.getState().notice).toBeNull();
  });

  it('keeps the notice already showing rather than swapping it under the reader', () => {
    showNotice('First', 'one');
    showNotice('Second', 'two');
    expect(useNoticeStore.getState().notice?.title).toBe('First');
  });
});
