import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { LetterRow } from '../LetterRow';
import { ACCENT, FONTS, INK } from '../../../lib/theme';

import type { Message } from '../../../hooks/useChat';

const base: Message = { id: 'm1', matchId: 'x', senderId: 'me', content: 'A line', createdAt: new Date().toISOString() };

describe('LetterRow', () => {
  it('sets my line in italic gold and theirs in roman', () => {
    const mine = render(<LetterRow message={base} myId="me" initial="Х" />);
    expect(StyleSheet.flatten(mine.getByText('A line').props.style)).toEqual(
      expect.objectContaining({ fontFamily: FONTS.bodyItalic, color: ACCENT.base }),
    );
    const theirs = render(<LetterRow message={{ ...base, senderId: 'other' }} myId="me" initial="С" />);
    expect(StyleSheet.flatten(theirs.getByText('A line').props.style)).toEqual(
      expect.objectContaining({ fontFamily: FONTS.body, color: INK.primary }),
    );
  });

  it('shows the sigil initial', () => {
    expect(render(<LetterRow message={base} myId="me" initial="Х" />).getByText('Х')).toBeTruthy();
  });

  it('dims a sending line and offers retry on a failed one', () => {
    expect(
      StyleSheet.flatten(render(<LetterRow message={{ ...base, status: 'sending' }} myId="me" initial="Х" />).getByTestId('letter').props.style),
    ).toEqual(expect.objectContaining({ opacity: 0.8 }));
    const onRetry = jest.fn();
    const { getByLabelText } = render(
      <LetterRow message={{ ...base, status: 'failed' }} myId="me" initial="Х" onRetry={onRetry} />,
    );
    fireEvent.press(getByLabelText('Failed to send — tap to retry'));
    expect(onRetry).toHaveBeenCalledWith('m1');
  });
});
