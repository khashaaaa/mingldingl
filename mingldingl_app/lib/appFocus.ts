import { AppState, Platform, type AppStateStatus } from 'react-native';
import { focusManager } from '@tanstack/react-query';

export function wireFocusToAppState(): () => void {
  if (Platform.OS === 'web') return () => {};
  const onAppStateChange = (status: AppStateStatus) => {
    focusManager.setFocused(status === 'active');
  };
  const subscription = AppState.addEventListener('change', onAppStateChange);
  return () => subscription.remove();
}
