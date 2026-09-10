import { render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { MessageBubble } from '../MessageBubble';

import type { Message } from '../../../hooks/useChat';

const base: Message = {
  id: 'm1',
  matchId: 'match1',
  senderId: 'me',
  content: 'hello',
  createdAt: new Date().toISOString(),
};

describe('MessageBubble in flight', () => {
  it('shows a sending message as not yet inked', () => {
    const { getByTestId } = render(
      <MessageBubble message={{ ...base, status: 'sending' }} myId="me" />,
    );
    expect(StyleSheet.flatten(getByTestId('bubble').props.style)).toEqual(
      expect.objectContaining({ opacity: expect.any(Number) }),
    );
  });

  it('inks a delivered message fully', () => {
    const { getByTestId } = render(<MessageBubble message={base} myId="me" />);
    // A delivered bubble must carry no dimming at all, so assert on the flattened result rather
    // than hunting for an absent entry in a style array.
    const flat = StyleSheet.flatten(getByTestId('bubble').props.style);
    expect(flat.opacity).toBeUndefined();
  });
});
