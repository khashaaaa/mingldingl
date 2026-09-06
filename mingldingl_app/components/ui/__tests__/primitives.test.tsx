import { createRef } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet, Text, TextInput } from 'react-native';
import { CardEyebrow } from '../CardEyebrow';
import { TextField } from '../TextField';
import { ScreenHeader } from '../ScreenHeader';
import { COLORS, FONTS, FONT_SIZES, LINE } from '../../../lib/theme';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    back: mockBack,
  }),
}));

describe('CardEyebrow', () => {
  it('uppercases its label so call sites do not have to', () => {
    const { getByText } = render(<CardEyebrow>Thread log</CardEyebrow>);
    expect(getByText('THREAD LOG')).toBeTruthy();
  });

  it('sets small labels in the utility face, not the display serif', () => {
    const { getByText } = render(<CardEyebrow>trophies</CardEyebrow>);
    const style = StyleSheet.flatten(getByText('TROPHIES').props.style);
    expect(style.fontFamily).toBe(FONTS.utility);
    expect(style.fontSize).toBe(FONT_SIZES.xs);
  });

  it('defaults to dim text and accepts an accent colour', () => {
    const { getByText, rerender } = render(<CardEyebrow>quests</CardEyebrow>);
    expect(StyleSheet.flatten(getByText('QUESTS').props.style).color).toBe(COLORS.textDim);

    rerender(<CardEyebrow color={COLORS.gold}>quests</CardEyebrow>);
    expect(StyleSheet.flatten(getByText('QUESTS').props.style).color).toBe(COLORS.gold);
  });

  it('uppercases Mongolian Cyrillic labels', () => {
    const { getByText } = render(<CardEyebrow>Өдрийн даалгавар</CardEyebrow>);
    expect(getByText('ӨДРИЙН ДААЛГАВАР')).toBeTruthy();
  });
});

describe('TextField', () => {
  it('is a panel-coloured field with a contrast-passing edge, in the body face', () => {
    const { getByPlaceholderText } = render(<TextField placeholder="name" />);
    const style = StyleSheet.flatten(getByPlaceholderText('name').props.style);
    expect(style.backgroundColor).toBe(COLORS.panel);
    expect(style.borderColor).toBe(LINE.edge);
    expect(style.fontFamily).toBe(FONTS.body);
    expect(style.height).toBe(52);
  });

  it('grows as a text area when multiline, anchored to the top', () => {
    const { getByPlaceholderText } = render(<TextField placeholder="bio" multiline maxHeight={132} />);
    const input = getByPlaceholderText('bio');
    const style = StyleSheet.flatten(input.props.style);
    expect(style.height).toBeUndefined();
    expect(style.minHeight).toBeGreaterThan(52);
    expect(style.maxHeight).toBe(132);
    expect(input.props.textAlignVertical).toBe('top');
  });

  it('dims its placeholder by default, forwards its ref and text events', () => {
    const ref = createRef<TextInput>();
    const onChangeText = jest.fn();
    const { getByPlaceholderText } = render(<TextField ref={ref} placeholder="age" onChangeText={onChangeText} />);
    const input = getByPlaceholderText('age');
    expect(input.props.placeholderTextColor).toBe(COLORS.textDim);
    fireEvent.changeText(input, '27');
    expect(onChangeText).toHaveBeenCalledWith('27');
    expect(ref.current).toBeTruthy();
  });
});

describe('ScreenHeader', () => {
  beforeEach(() => {
    mockBack.mockClear();
  });

  it('renders the title and fires onBack when the back arrow is pressed', () => {
    const onBack = jest.fn();
    const { getByText, getByLabelText } = render(<ScreenHeader title="Guild Rank" onBack={onBack} />);

    expect(getByText('Guild Rank')).toBeTruthy();

    fireEvent.press(getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders the right slot when provided', () => {
    const { getByText } = render(
      <ScreenHeader title="Chat" onBack={() => {}} right={<Text>📹</Text>} />
    );
    expect(getByText('📹')).toBeTruthy();
  });

  it('calls router.back() when back arrow is pressed and no onBack prop is provided', () => {
    const { getByText, getByLabelText } = render(<ScreenHeader title="Guild Rank" />);

    expect(getByText('Guild Rank')).toBeTruthy();

    fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('labels the back arrow for screen readers via i18n', () => {
    const { getByLabelText } = render(<ScreenHeader title="Guild Rank" />);
    expect(getByLabelText('Back')).toBeTruthy();
  });
});
