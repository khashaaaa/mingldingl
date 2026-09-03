import { createRef } from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { StyleSheet, TextInput } from 'react-native';
import { TextField } from '../TextField';
import { COLORS, FONTS } from '../../../lib/theme';

describe('TextField', () => {
  it('is a panel-coloured, bronze-bordered field in the body face', () => {
    const { getByPlaceholderText } = render(<TextField placeholder="name" />);
    const style = StyleSheet.flatten(getByPlaceholderText('name').props.style);
    expect(style.backgroundColor).toBe(COLORS.panel);
    expect(style.borderColor).toBe(COLORS.bronze);
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
