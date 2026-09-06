import * as SecureStore from 'expo-secure-store';

const KEY = 'world-sound';

/**
 * Device-local, like the locale override — this is a preference about *this* phone in *this*
 * room, not an account setting worth a round trip. `expo-secure-store` is an empty module on web,
 * so both calls are written to survive it throwing.
 */
export async function getStoredSound(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(KEY)) === 'on';
  } catch {
    return false;
  }
}

export async function setStoredSound(on: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(KEY, on ? 'on' : 'off');
  } catch {
    // A web session simply does not remember; the in-memory store still honours the choice.
  }
}
