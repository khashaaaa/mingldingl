import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';

/**
 * Every moment the world answers to, from Figma's motion set (page 02). One row each — adding a
 * moment means adding a row here, never a haptic or sound at a call site.
 */
export const WORLD_EVENTS = [
  'press',
  'roomDeeper',
  'roomHome',
  'sealStamp',
  'sealBreak',
  'emberFlare',
  'candle',
  'frostCreep',
  'rewardBurst',
  'honourDrop',
  'chestOpen',
  'bell',
  'tierUp',
] as const;
export type WorldEvent = (typeof WORLD_EVENTS)[number];

type Haptic = 'soft' | 'light' | 'medium' | 'heavy' | 'success' | 'warning' | null;
type Row = { haptic: Haptic; repeat?: number; soundFile: string | null; sound: number | null };

const row = (haptic: Haptic, soundFile: string | null, sound: number | null, repeat?: number): Row => ({
  haptic,
  soundFile,
  sound,
  repeat,
});

export const FEEDBACK: Record<WorldEvent, Row> = {
  press: row('soft', 'tick.wav', require('../../../assets/sounds/tick.wav')),
  roomDeeper: row('soft', 'door.wav', require('../../../assets/sounds/door.wav')),
  roomHome: row('soft', 'rise.wav', require('../../../assets/sounds/rise.wav')),
  sealStamp: row('heavy', 'seal.wav', require('../../../assets/sounds/seal.wav')),
  sealBreak: row('heavy', 'seal.wav', require('../../../assets/sounds/seal.wav')),
  emberFlare: row('warning', 'due.wav', require('../../../assets/sounds/due.wav')),
  candle: row(null, 'candle.wav', require('../../../assets/sounds/candle.wav')),
  frostCreep: row('soft', 'dying.wav', require('../../../assets/sounds/dying.wav')),
  rewardBurst: row('success', 'honour.wav', require('../../../assets/sounds/honour.wav')),
  honourDrop: row('success', 'honour.wav', require('../../../assets/sounds/honour.wav')),
  chestOpen: row('heavy', 'anvil.wav', require('../../../assets/sounds/anvil.wav')),
  bell: row('medium', 'bell.wav', require('../../../assets/sounds/bell.wav')),
  tierUp: row('heavy', 'anvil.wav', require('../../../assets/sounds/anvil.wav'), 2),
};

const REPEAT_GAP_MS = 110;
let soundEnabled = false;
let hapticsEnabled = true;
let players: Partial<Record<WorldEvent, AudioPlayer>> | null = null;

/** Sound is opt-in (Settings → Sound); nothing is loaded until it is on. */
export function setSoundEnabled(on: boolean) {
  soundEnabled = on;
  if (!on && players) {
    for (const p of Object.values(players)) p?.remove();
    players = null;
  }
}

function player(e: WorldEvent): AudioPlayer | null {
  const src = FEEDBACK[e].sound;
  if (src === null) return null;
  if (!players) {
    players = {};
    // Never over the silent switch (iOS); on Android these follow the media volume. They mix
    // under the person's own music: without it every tick took audio focus and paused it.
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(() => {});
  }
  players[e] ??= createAudioPlayer(src);
  return players[e] ?? null;
}

async function haptic(h: Haptic) {
  switch (h) {
    case null:
      return;
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    default:
      return Haptics.impactAsync(
        {
          soft: Haptics.ImpactFeedbackStyle.Soft,
          light: Haptics.ImpactFeedbackStyle.Light,
          medium: Haptics.ImpactFeedbackStyle.Medium,
          heavy: Haptics.ImpactFeedbackStyle.Heavy,
        }[h],
      );
  }
}

/** Haptics fire unless switched off (Reduce Motion keeps them, M7); sound only when switched on. */
export async function feedback(e: WorldEvent) {
  const r = FEEDBACK[e];
  if (soundEnabled) {
    const p = player(e);
    if (p) {
      p.seekTo(0);
      p.play();
    }
  }
  if (!hapticsEnabled) return;
  for (let i = 0; i < (r.repeat ?? 1); i++) {
    if (i > 0) await new Promise((res) => setTimeout(res, REPEAT_GAP_MS));
    await haptic(r.haptic).catch(() => {});
  }
}

/** Development (Tools → Hear every sound): an event's sound alone, whatever Settings → Sound says. */
export function hearSound(e: WorldEvent) {
  const p = player(e);
  if (p) {
    p.seekTo(0);
    p.play();
  }
}

const SOUND_KEY = 'mingl.sound';
const HAPTICS_KEY = 'mingl.haptics';

/** War Room → Sound and Haptics are per device (not the profile): read once at launch. */
export async function loadSoundSetting() {
  setSoundEnabled((await SecureStore.getItemAsync(SOUND_KEY)) === 'on');
  hapticsEnabled = (await SecureStore.getItemAsync(HAPTICS_KEY)) !== 'off';
}

export async function saveSoundSetting(on: boolean) {
  await SecureStore.setItemAsync(SOUND_KEY, on ? 'on' : 'off');
  setSoundEnabled(on);
}

export async function saveHapticsSetting(on: boolean) {
  hapticsEnabled = on;
  await SecureStore.setItemAsync(HAPTICS_KEY, on ? 'on' : 'off');
}

export function deviceFeel() {
  return { sound: soundEnabled, haptics: hapticsEnabled };
}
