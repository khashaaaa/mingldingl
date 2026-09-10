import { Modal, Text } from 'react-native';
import { render } from '@testing-library/react-native';
import { AppModal } from '../AppModal';

/**
 * The whole point of this wrapper is that every `Modal` in the app opens edge-to-edge on
 * Android, so the system paints its own bars transparent instead of the OS's white default
 * (see the comment on AppModal for why `expo-navigation-bar` can't do this and RN's own
 * `Modal` props can). This only checks the props reach the underlying `Modal` correctly —
 * whether the system bar actually renders dark behind a real device's Modal window is device-
 * only and out of reach for jest.
 */
describe('AppModal', () => {
  it('defaults to a translucent status bar and navigation bar', () => {
    const { UNSAFE_getByType } = render(
      <AppModal visible>
        <Text>content</Text>
      </AppModal>,
    );

    const modal = UNSAFE_getByType(Modal);
    expect(modal.props.statusBarTranslucent).toBe(true);
    expect(modal.props.navigationBarTranslucent).toBe(true);
  });

  it('lets a caller override either translucency prop', () => {
    const { UNSAFE_getByType } = render(
      <AppModal visible statusBarTranslucent={false} navigationBarTranslucent={false}>
        <Text>content</Text>
      </AppModal>,
    );

    const modal = UNSAFE_getByType(Modal);
    expect(modal.props.statusBarTranslucent).toBe(false);
    expect(modal.props.navigationBarTranslucent).toBe(false);
  });

  it('passes every other Modal prop straight through unchanged', () => {
    const onRequestClose = jest.fn();
    const { UNSAFE_getByType } = render(
      <AppModal visible transparent animationType="fade" onRequestClose={onRequestClose}>
        <Text>content</Text>
      </AppModal>,
    );

    const modal = UNSAFE_getByType(Modal);
    expect(modal.props.visible).toBe(true);
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.animationType).toBe('fade');
    expect(modal.props.onRequestClose).toBe(onRequestClose);
  });
});
