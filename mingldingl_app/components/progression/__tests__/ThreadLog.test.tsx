import { render } from '@testing-library/react-native';
import { ThreadLog } from '../ThreadLog';

describe('ThreadLog', () => {
  it('shows the empty state when no ship-milestone titles are owned', () => {
    const { getByText } = render(<ThreadLog ownedItemIds={[]} />);
    expect(getByText(/No threads woven yet/i)).toBeTruthy();
  });

  it('shows the Thread-Weaver title once earned', () => {
    const { getByText } = render(<ThreadLog ownedItemIds={['title_threadweaver']} />);
    expect(getByText('Thread-Weaver')).toBeTruthy();
  });

  it('shows all three milestone titles once earned, in ascending order', () => {
    const { getByText } = render(
      <ThreadLog ownedItemIds={['title_bondkeeper', 'title_threadweaver', 'title_fateseer']} />,
    );
    expect(getByText('Thread-Weaver')).toBeTruthy();
    expect(getByText('Fate-Seer')).toBeTruthy();
    expect(getByText('Bond-Keeper')).toBeTruthy();
  });
});
