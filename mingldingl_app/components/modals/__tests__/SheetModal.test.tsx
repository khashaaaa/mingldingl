import { Platform, Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { SheetModal } from '../SheetModal';

/**
 * The whole point of this component is the iOS defer: a native picker cannot be presented over a
 * modal that is still closing, so the action has to wait for `onDismiss`. That behaviour used to
 * live inline in PhotoGrid; now three call sites depend on it.
 */
function renderSheet(onClose = jest.fn(), action = jest.fn()) {
  const utils = render(
    <SheetModal visible onClose={onClose}>
      {(closeThen) => <Text onPress={() => closeThen(action)}>trigger</Text>}
    </SheetModal>,
  );
  return { ...utils, onClose, action };
}

describe('SheetModal closeThen', () => {
  const realOS = Platform.OS;
  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: realOS, configurable: true });
  });

  function setPlatform(os: typeof Platform.OS) {
    Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  }

  it('on iOS, closes first and runs the action only once the sheet has dismissed', () => {
    setPlatform('ios');
    const { getByText, onClose, action, UNSAFE_getByType } = renderSheet();

    fireEvent.press(getByText('trigger'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(action).not.toHaveBeenCalled();

    const modal = UNSAFE_getByType(require('react-native').Modal);
    modal.props.onDismiss();
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('on iOS, does not re-run a spent action on a later dismissal', () => {
    setPlatform('ios');
    const { getByText, action, UNSAFE_getByType } = renderSheet();
    const modal = UNSAFE_getByType(require('react-native').Modal);

    fireEvent.press(getByText('trigger'));
    modal.props.onDismiss();
    modal.props.onDismiss();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it('on iOS, a dismissal with nothing parked runs nothing', () => {
    setPlatform('ios');
    const { action, UNSAFE_getByType } = renderSheet();

    UNSAFE_getByType(require('react-native').Modal).props.onDismiss();

    expect(action).not.toHaveBeenCalled();
  });

  it('elsewhere, closes and runs the action straight away', () => {
    setPlatform('android');
    const { getByText, onClose, action } = renderSheet();

    fireEvent.press(getByText('trigger'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(action).toHaveBeenCalledTimes(1);
  });

  it('accepts plain children as well as a render function', () => {
    const { getByText } = render(
      <SheetModal visible onClose={() => {}}>
        <Text>plain child</Text>
      </SheetModal>,
    );
    expect(getByText('plain child')).toBeTruthy();
  });
});
