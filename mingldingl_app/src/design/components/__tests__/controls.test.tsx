import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { setLocale } from '@/lib/i18n';
import { color, type } from '../../tokens';
import { Button } from '../Button';
import { ChoiceCard } from '../ChoiceCard';
import { Dialog } from '../Dialog';
import { InkLink } from '../InkLink';
import { Input } from '../Input';
import { PickRow } from '../PickRow';
import { RevealContext } from '../reveal';
import { Sheet } from '../Sheet';
import { StateBlock } from '../StateBlock';
import { TextArea } from '../TextArea';
import { Toast } from '../Toast';
import { Txt } from '../Txt';

jest.mock('@/lib/feedback', () => ({ feedback: jest.fn() }));
const { feedback } = jest.requireMock('@/lib/feedback') as { feedback: jest.Mock };
beforeEach(() => feedback.mockClear());
afterEach(() => setLocale('en'));

describe('Txt', () => {
  test('uses the Figma text style and switches room titles to Yeseva in Mongolian', async () => {
    const { rerender } = await render(<Txt variant="titleRoom">The Gate</Txt>);
    expect(screen.getByText('The Gate')).toHaveStyle({ fontFamily: type.titleRoom.fontFamily });
    await act(() => setLocale('mn'));
    await rerender(<Txt variant="titleRoom">The Gate</Txt>);
    expect(screen.getByText('The Gate')).toHaveStyle({ fontFamily: 'YesevaOne_400Regular' });
  });
});

describe('Button', () => {
  test('presses with a tick and calls back', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} />);
    const b = screen.getByRole('button', { name: 'Continue' });
    await fireEvent(b, 'pressIn');
    await fireEvent.press(b);
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(feedback).toHaveBeenCalledWith('press');
  });
  test('disabled ignores presses and says so', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} disabled />);
    const b = screen.getByRole('button', { name: 'Continue' });
    await fireEvent.press(b);
    expect(onPress).not.toHaveBeenCalled();
    expect(b.props.accessibilityState).toMatchObject({ disabled: true });
  });
  test('loading is busy and not pressable', async () => {
    const onPress = jest.fn();
    await render(<Button label="Continue" onPress={onPress} loading />);
    const b = screen.getByRole('button', { name: 'Continue' });
    await fireEvent.press(b);
    expect(onPress).not.toHaveBeenCalled();
    expect(b.props.accessibilityState).toMatchObject({ busy: true });
  });
  test('the label is uppercase Label/M on the brass', async () => {
    await render(<Button label="Continue" onPress={() => {}} />);
    expect(screen.getByText('Continue')).toHaveStyle({ textTransform: 'uppercase', color: color.bgBase });
  });
});

describe('InkLink', () => {
  test('is a link in the app voice', async () => {
    const onPress = jest.fn();
    await render(<InkLink label="Use another number" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('link', { name: 'Use another number' }));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByText('Use another number')).toHaveStyle({ fontFamily: type.voiceM.fontFamily });
  });
});

describe('Input', () => {
  test('shows its label and the error text', async () => {
    await render(<Input label="First name" value="" onChangeText={() => {}} error="Enter your name" />);
    expect(screen.getByText('First name')).toBeTruthy();
    expect(screen.getByText('Enter your name')).toHaveStyle({ color: color.textDanger });
  });
  test('passes typing through and respects maxLength', async () => {
    const onChange = jest.fn();
    await render(<Input label="First name" value="" onChangeText={onChange} maxLength={40} />);
    const field = screen.getByLabelText('First name');
    await fireEvent.changeText(field, 'Saruul');
    expect(onChange).toHaveBeenCalledWith('Saruul');
    expect(field.props.maxLength).toBe(40);
  });
});

describe('TextArea', () => {
  test('counts characters against its limit', async () => {
    await render(
      <TextArea label="Your tale" value="Rides at dawn" onChangeText={() => {}} maxLength={300} />,
    );
    expect(screen.getByText('13 / 300')).toBeTruthy();
  });

  test('passes focus and blur on, and asks the screen to reveal it while focused', async () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const reveal = jest.fn();
    await render(
      <RevealContext.Provider value={reveal}>
        <TextArea label="Your tale" value="" onChangeText={() => {}} onFocus={onFocus} onBlur={onBlur} />
      </RevealContext.Provider>,
    );
    await fireEvent(screen.getByLabelText('Your tale'), 'focus');
    expect(onFocus).toHaveBeenCalled();
    expect(reveal).toHaveBeenLastCalledWith(expect.anything());
    await fireEvent(screen.getByLabelText('Your tale'), 'blur');
    expect(onBlur).toHaveBeenCalled();
    expect(reveal).toHaveBeenLastCalledWith(null);
  });
});

describe('ChoiceCard', () => {
  test('selected shows the corner caps and is a checked radio', async () => {
    const { rerender } = await render(
      <ChoiceCard glyph="knot" title="Bond" body="A partner" selected={false} onPress={() => {}} />,
    );
    expect(screen.queryAllByTestId('corner-cap')).toHaveLength(0);
    await rerender(<ChoiceCard glyph="knot" title="Bond" body="A partner" selected onPress={() => {}} />);
    expect(screen.getAllByTestId('corner-cap')).toHaveLength(4);
    expect(screen.getByRole('radio').props.accessibilityState).toMatchObject({ checked: true });
  });
});

describe('PickRow', () => {
  test('selected is gold and checked; a group row is a header', async () => {
    await render(
      <>
        <PickRow kind="group" label="Provinces" />
        <PickRow label="Bayangol" selected onPress={() => {}} />
      </>,
    );
    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByText('Bayangol')).toHaveStyle({ color: color.accentGoldBright });
  });

  test('a row that opens to others says whether it is open', async () => {
    await render(<PickRow label="Ulaanbaatar" expanded={false} onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ulaanbaatar' }).props.accessibilityState).toEqual({
      selected: false,
      expanded: false,
    });
  });
});

describe('Toast', () => {
  test('error toasts are alerts', async () => {
    await render(<Toast kind="error" message="No connection" />);
    expect(screen.getByRole('alert')).toBeTruthy();
  });
});

describe('StateBlock', () => {
  test('error title is ember and offers the action', async () => {
    const onAction = jest.fn();
    await render(
      <StateBlock
        kind="error"
        title="The path falters"
        body="Try again"
        action={{ label: 'Try again', onPress: onAction }}
      />,
    );
    expect(screen.getByText('The path falters')).toHaveStyle({ color: color.textDanger });
    await fireEvent.press(screen.getByRole('link', { name: 'Try again' }));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('Sheet and Dialog', () => {
  test('a closed sheet renders nothing; an open one has its title and drawer pull', async () => {
    const { rerender } = await render(
      <Sheet open={false} title="Where do you live?" onClose={() => {}}>
        <Text>body</Text>
      </Sheet>,
    );
    expect(screen.queryByText('Where do you live?')).toBeNull();
    await rerender(
      <Sheet open title="Where do you live?" onClose={() => {}}>
        <Text>body</Text>
      </Sheet>,
    );
    expect(screen.getByText('Where do you live?')).toBeTruthy();
    expect(screen.getByTestId('drawer-pull')).toBeTruthy();
  });
  test('opening an overlay puts the keyboard away (a ceremony over a focused composer)', async () => {
    const dismiss = jest.spyOn(require('react-native').Keyboard, 'dismiss');
    const { rerender } = await render(
      <Sheet open={false} title="T" onClose={() => {}}>
        <Text>b</Text>
      </Sheet>,
    );
    expect(dismiss).not.toHaveBeenCalled();
    await rerender(
      <Sheet open title="T" onClose={() => {}}>
        <Text>b</Text>
      </Sheet>,
    );
    expect(dismiss).toHaveBeenCalledTimes(1);
    dismiss.mockRestore();
  });
  test('tapping the scrim closes a sheet', async () => {
    const onClose = jest.fn();
    await render(
      <Sheet open title="T" onClose={onClose}>
        <Text>b</Text>
      </Sheet>,
    );
    await fireEvent.press(screen.getByTestId('scrim', { includeHiddenElements: true }));
    expect(onClose).toHaveBeenCalled();
  });
  test('a dialog has four corner caps and its actions', async () => {
    const confirm = jest.fn();
    await render(
      <Dialog
        open
        title="Leave without saving?"
        body="Your changes will be lost."
        confirm={{ label: 'Discard', onPress: confirm, danger: true }}
        cancel={{ label: 'Cancel', onPress: () => {} }}
      />,
    );
    expect(screen.getAllByTestId('corner-cap')).toHaveLength(4);
    await fireEvent.press(screen.getByRole('button', { name: 'Discard' }));
    expect(confirm).toHaveBeenCalled();
  });
});
