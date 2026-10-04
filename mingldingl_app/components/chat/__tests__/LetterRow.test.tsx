import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { LetterRow, nearestAspect, variantOf } from '../LetterRow';
import { STONE_ASPECTS, STONE_IMAGES } from '../stoneImages';
import { FONTS, INK } from '../../../lib/theme';

import type { Message } from '../../../hooks/useChat';

const base: Message = { id: 'm1', matchId: 'x', senderId: 'me', content: 'A line', createdAt: new Date().toISOString() };

const flat = (style: unknown) => StyleSheet.flatten(style as never) as Record<string, unknown>;

describe('LetterRow', () => {
  it('sets my line in the app\'s italic and theirs in roman, both legible on the stone', () => {
    const mine = render(<LetterRow message={base} myId="me" />);
    expect(flat(mine.getByText('A line').props.style)).toEqual(
      expect.objectContaining({ fontFamily: FONTS.bodyItalic, color: INK.primary }),
    );
    const theirs = render(<LetterRow message={{ ...base, senderId: 'other' }} myId="me" />);
    expect(flat(theirs.getByText('A line').props.style)).toEqual(
      expect.objectContaining({ fontFamily: FONTS.body, color: INK.primary }),
    );
  });

  it('floats mine on the right and theirs on the left', () => {
    const mine = render(<LetterRow message={base} myId="me" />).getByTestId('letter');
    expect(flat(mine.props.style).justifyContent).toBe('flex-end');
    const theirs = render(<LetterRow message={{ ...base, senderId: 'other' }} myId="me" />).getByTestId('letter');
    expect(flat(theirs.props.style).justifyContent).toBe('flex-start');
  });

  it('puts mine on sandstone and theirs on slate, once the letter has measured itself', () => {
    const Image = require('react-native').Image;
    const stoneOf = (message: Message) => {
      const el = render(<LetterRow message={message} myId="me" />);
      // The stone waits for the row's own measure, so it is sized in points rather than percent.
      fireEvent(el.getByText('A line').parent!.parent!, 'layout', { nativeEvent: { layout: { width: 200, height: 60 } } });
      return el.UNSAFE_getAllByType(Image).map((i: { props: { source: unknown } }) => i.props.source);
    };
    const sand = STONE_IMAGES.sand.flat();
    const slate = STONE_IMAGES.slate.flat();
    expect(stoneOf(base).some((s) => sand.includes(s as never))).toBe(true);
    expect(stoneOf({ ...base, senderId: 'other' }).some((s) => slate.includes(s as never))).toBe(true);
  });

  it('picks the baked shard nearest the letter\'s shape, and the same break of rock every time', () => {
    expect(nearestAspect(1)).toBe(0);
    expect(nearestAspect(100)).toBe(STONE_ASPECTS.length - 1);
    expect(nearestAspect(STONE_ASPECTS[2])).toBe(2);
    expect(variantOf('abc')).toBe(variantOf('abc'));
    expect(variantOf('abc')).toBeLessThan(STONE_IMAGES.sand[0].length);
  });

  it('dims a sending line and offers retry on a failed one', () => {
    expect(
      flat(render(<LetterRow message={{ ...base, status: 'sending' }} myId="me" />).getByTestId('letter').props.style),
    ).toEqual(expect.objectContaining({ opacity: 0.8 }));
    const onRetry = jest.fn();
    const { getByLabelText } = render(
      <LetterRow message={{ ...base, status: 'failed' }} myId="me" onRetry={onRetry} />,
    );
    // The label leads with the letter's own words: the wrapper hides its children from a screen
    // reader, so "tap to retry" alone left no way to tell which letter had failed.
    fireEvent.press(getByLabelText('A line. Failed to send — tap to retry'));
    expect(onRetry).toHaveBeenCalledWith('m1');
  });

  it('shows a letter only once its stone can be drawn, never as bare text', () => {
    const el = render(<LetterRow message={base} myId="me" />);
    expect(flat(el.getByTestId('letter-shard').props.style).opacity).toBe(0);
    fireEvent(el.getByText('A line').parent!.parent!, 'layout', { nativeEvent: { layout: { width: 200, height: 60 } } });
    expect(flat(el.getByTestId('letter-shard').props.style).opacity).not.toBe(0);
  });

});
