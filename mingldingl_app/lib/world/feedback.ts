import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * The moments the hold answers to. A closed union with one table entry each, the way `PushCopy`
 * maps a push kind to its copy — adding a moment means adding a row, never a literal at a call
 * site, so the whole world's feedback stays readable in one place. `press` is the one ordinary
 * moment here — every `GameButton` ticks on press-in — and `horn` is a short call for a summons.
 */
export type WorldEvent =
  | 'enterDeep' | 'ascend' | 'tierUp' | 'sealBreak' | 'honour' | 'pledgeKept' | 'press' | 'horn';

type HapticKind = 'soft' | 'light' | 'medium' | 'heavy' | 'success';

interface EventDef {
  readonly haptic: HapticKind;
  /** Fires twice, `gap` ms apart, for moments that want weight (the anvil). */
  readonly repeat?: number;
  readonly sound: number | null;
}

const SIGNALS: Record<WorldEvent, EventDef> = {
  enterDeep: { haptic: 'soft',    sound: require('../../assets/sounds/door.wav') },
  ascend:    { haptic: 'soft',    sound: require('../../assets/sounds/rise.wav') },
  tierUp:    { haptic: 'heavy',   sound: require('../../assets/sounds/anvil.wav'), repeat: 2 },
  sealBreak: { haptic: 'heavy',   sound: require('../../assets/sounds/seal.wav') },
  honour:    { haptic: 'success', sound: require('../../assets/sounds/honour.wav') },
  pledgeKept:{ haptic: 'success', sound: require('../../assets/sounds/pledge.wav') },
  press:     { haptic: 'soft',    sound: require('../../assets/sounds/tick.wav') },
  horn:      { haptic: 'light',   sound: require('../../assets/sounds/horn.wav') },
};

const REPEAT_GAP_MS = 110;

/**
 * Sound is opt-in and starts off, so nothing is loaded until someone turns it on. Set by the
 * store on hydration and on every change.
 */
let soundEnabled = false;
let players: Partial<Record<WorldEvent, AudioPlayer>> | null = null;
/** Muted for the duration of an Agora call — the hold does not speak over a conversation. */
let muted = false;

export function setSoundEnabled(on: boolean): void {
  soundEnabled = on;
  if (!on) releasePlayers();
}

export function setFeedbackMuted(value: boolean): void {
  muted = value;
}

function releasePlayers(): void {
  if (!players) return;
  for (const player of Object.values(players)) {
    try { player?.remove(); } catch { /* already gone */ }
  }
  players = null;
}

function ensurePlayers(): Partial<Record<WorldEvent, AudioPlayer>> {
  if (players) return players;
  // `playsInSilentMode: false` is the whole point: a dating app that speaks while the phone is
  // silenced is a bug no setting excuses.
  setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
  players = {};
  for (const [event, def] of Object.entries(SIGNALS) as [WorldEvent, EventDef][]) {
    if (def.sound == null) continue;
    try { players[event] = createAudioPlayer(def.sound); } catch { /* leave it silent */ }
  }
  return players;
}

function fireHaptic(kind: HapticKind): void {
  // Web has no haptic engine at all; calling through would reject on every event.
  if (Platform.OS === 'web') return;
  const call = kind === 'success'
    ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : Haptics.impactAsync({
      soft: Haptics.ImpactFeedbackStyle.Soft,
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    }[kind]);
  // A device with no motor rejects rather than no-opping; that is not an error worth surfacing.
  call.catch(() => {});
}

/**
 * The one entry point. Haptics always (the OS owns the user's system-level preference); sound
 * only once it has been switched on in Settings.
 */
export function signal(event: WorldEvent): void {
  if (muted) return;
  const def = SIGNALS[event];
  if (!def) return;

  fireHaptic(def.haptic);
  for (let i = 1; i < (def.repeat ?? 1); i++) {
    setTimeout(() => fireHaptic(def.haptic), REPEAT_GAP_MS * i);
  }

  if (!soundEnabled || def.sound == null) return;
  const player = ensurePlayers()[event];
  if (!player) return;
  try {
    // Rewind first: a second honour inside one second must be heard, not swallowed.
    player.seekTo(0).catch(() => {});
    player.play();
  } catch { /* a player that died with the audio session is not worth a crash */ }
}

/** Test seam — resets the module between cases. */
export function __resetFeedback(): void {
  releasePlayers();
  soundEnabled = false;
  muted = false;
}
