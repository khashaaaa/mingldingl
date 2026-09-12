import { createRef } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet, Text, TextInput } from 'react-native';
import { CardEyebrow } from '../CardEyebrow';
import { TextField } from '../TextField';
import { HeaderBar } from '../HeaderBar';
import { ChoiceRow } from '../ChoiceRow';
import { i18n, translations } from '../../../lib/i18n';
import { ACCENT, FONTS, FONT_SIZES, INK, LINE, SURFACE } from '../../../lib/theme';

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
    expect(StyleSheet.flatten(getByText('QUESTS').props.style).color).toBe(INK.dim);

    rerender(<CardEyebrow color={ACCENT.base}>quests</CardEyebrow>);
    expect(StyleSheet.flatten(getByText('QUESTS').props.style).color).toBe(ACCENT.base);
  });

  it('uppercases Mongolian Cyrillic labels', () => {
    const { getByText } = render(<CardEyebrow>Өдрийн даалгавар</CardEyebrow>);
    expect(getByText('ӨДРИЙН ДААЛГАВАР')).toBeTruthy();
  });

  it('shrinks rather than clips a long Mongolian label', () => {
    const { getByText } = render(<CardEyebrow>Өдрийн даалгавар</CardEyebrow>);
    const style = StyleSheet.flatten(getByText('ӨДРИЙН ДААЛГАВАР').props.style);
    expect(style.flexShrink).toBe(1);
  });
});

describe('ChoiceRow', () => {
  const originalLocale = i18n.locale;
  afterEach(() => {
    i18n.locale = originalLocale;
  });

  it('wraps and shrinks Mongolian chip labels instead of clipping them', () => {
    i18n.locale = 'mn';
    const options = ['never', 'occasionally', 'regularly'] as const;
    const { getByText, getAllByRole } = render(
      <ChoiceRow
        label="Smoking"
        value="occasionally"
        options={options}
        optionLabel={(opt) => translations.mn[`habit_${opt}`]}
        onChange={() => {}}
      />
    );

    // Climb past the chip's own `Tap`/`TouchableOpacity` wrapper layers to the row
    // that actually holds `flexWrap`.
    let optionsContainer = getAllByRole('button')[0];
    while (optionsContainer && StyleSheet.flatten(optionsContainer.props?.style)?.flexWrap !== 'wrap') {
      optionsContainer = optionsContainer.parent;
    }
    expect(StyleSheet.flatten(optionsContainer?.props?.style).flexWrap).toBe('wrap');

    for (const opt of options) {
      const label = translations.mn[`habit_${opt}`];
      const textNode = getByText(label);
      const style = StyleSheet.flatten(textNode.props.style);
      expect(style.flexShrink).toBe(1);
      expect(textNode.props.numberOfLines).toBeUndefined();
    }
  });
});

describe('TextField', () => {
  it('is a panel-coloured field with a contrast-passing edge, in the body face', () => {
    const { getByPlaceholderText } = render(<TextField placeholder="name" />);
    const style = StyleSheet.flatten(getByPlaceholderText('name').props.style);
    expect(style.backgroundColor).toBe(SURFACE.panel);
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
    expect(input.props.placeholderTextColor).toBe(INK.dim);
    fireEvent.changeText(input, '27');
    expect(onChangeText).toHaveBeenCalledWith('27');
    expect(ref.current).toBeTruthy();
  });
});

describe('HeaderBar', () => {
  beforeEach(() => {
    mockBack.mockClear();
  });

  it('renders the title and fires onBack when the back arrow is pressed', () => {
    const onBack = jest.fn();
    const { getByText, getByLabelText } = render(<HeaderBar title="Guild Rank" onBack={onBack} />);

    expect(getByText('Guild Rank')).toBeTruthy();

    fireEvent.press(getByLabelText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('renders the right slot when provided', () => {
    const { getByText } = render(
      <HeaderBar title="Chat" onBack={() => {}} right={<Text>📹</Text>} />
    );
    expect(getByText('📹')).toBeTruthy();
  });

  it('calls router.back() when back arrow is pressed and no onBack prop is provided', () => {
    const { getByText, getByLabelText } = render(<HeaderBar title="Guild Rank" />);

    expect(getByText('Guild Rank')).toBeTruthy();

    fireEvent.press(getByLabelText('Back'));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('labels the back arrow for screen readers via i18n', () => {
    const { getByLabelText } = render(<HeaderBar title="Guild Rank" />);
    expect(getByLabelText('Back')).toBeTruthy();
  });
});
