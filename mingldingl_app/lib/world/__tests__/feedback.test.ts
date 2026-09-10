import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Audio from 'expo-audio';
import { __resetFeedback, setFeedbackMuted, setSoundEnabled, signal, type WorldEvent } from '../feedback';
import { animationFor } from '../travel';

const player = (Audio as unknown as { __player: { play: jest.Mock; seekTo: jest.Mock; remove: jest.Mock } }).__player;

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Soft: 'soft', Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success' },
}));

const impact = Haptics.impactAsync as jest.Mock;
const notify = Haptics.notificationAsync as jest.Mock;

describe('world feedback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    __resetFeedback();
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires a haptic with sound switched off — the body always hears it', () => {
    signal('enterDeep');
    expect(impact).toHaveBeenCalledWith('soft');
    expect(player.play).not.toHaveBeenCalled();
  });

  it('routes success-shaped moments through the notification engine, not impact', () => {
    signal('honour');
    expect(notify).toHaveBeenCalledWith('success');
    expect(impact).not.toHaveBeenCalled();
  });

  it('plays only once sound has been switched on', () => {
    setSoundEnabled(true);
    signal('sealBreak');
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('rewinds before playing, so a second honour inside a second is still heard', () => {
    setSoundEnabled(true);
    signal('honour');
    signal('honour');
    expect(player.seekTo).toHaveBeenCalledTimes(2);
    expect(player.seekTo).toHaveBeenCalledWith(0);
    expect(player.play).toHaveBeenCalledTimes(2);
  });

  it('refuses to play over the silent switch', () => {
    setSoundEnabled(true);
    signal('honour');
    expect(Audio.setAudioModeAsync).toHaveBeenCalledWith({ playsInSilentMode: false });
  });

  it('loads nothing until sound is enabled', () => {
    signal('honour');
    expect(Audio.createAudioPlayer).not.toHaveBeenCalled();
  });

  it('releases its players when sound is switched back off', () => {
    setSoundEnabled(true);
    signal('honour');
    setSoundEnabled(false);
    expect(player.remove).toHaveBeenCalled();
  });

  it('says nothing at all while muted for a call', () => {
    setSoundEnabled(true);
    setFeedbackMuted(true);
    signal('tierUp');
    expect(impact).not.toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
  });

  it('strikes the anvil twice for a tier-up', () => {
    signal('tierUp');
    expect(impact).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(200);
    expect(impact).toHaveBeenCalledTimes(2);
    expect(impact).toHaveBeenLastCalledWith('heavy');
  });

  it('ticks softly on an ordinary press', () => {
    signal('press');
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith('soft');
    expect(notify).not.toHaveBeenCalled();
  });

  it('sounds the horn with a light impact', () => {
    signal('horn');
    expect(impact).toHaveBeenCalledTimes(1);
    expect(impact).toHaveBeenCalledWith('light');
  });

  it('has a row, with a haptic and a sound, for every event in the union', () => {
    // `satisfies` makes adding a WorldEvent without extending this list a typecheck failure.
    const events = {
      enterDeep: true, ascend: true, tierUp: true, sealBreak: true,
      honour: true, pledgeKept: true, press: true, horn: true,
    } satisfies Record<WorldEvent, true>;
    setSoundEnabled(true);
    for (const event of Object.keys(events) as WorldEvent[]) {
      jest.clearAllMocks();
      signal(event);
      expect(impact.mock.calls.length + notify.mock.calls.length).toBeGreaterThanOrEqual(1);
      expect(player.play).toHaveBeenCalledTimes(1);
    }
  });

  it('does not reach for a haptic engine the web does not have', () => {
    const original = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    try {
      signal('enterDeep');
      expect(impact).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(Platform, 'OS', { value: original, configurable: true });
    }
  });
});

describe('travel', () => {
  it('opens a delve from below', () => {
    expect(animationFor('chat/[matchId]', false)).toBe('slide_from_bottom');
    expect(animationFor('campaign/[matchId]', false)).toBe('slide_from_bottom');
  });

  it('cuts between rooms at the same depth', () => {
    expect(animationFor('(tabs)/discover', false)).toBe('none');
    expect(animationFor('edit-profile', false)).toBe('none');
  });

  it('cuts for a route with no place in the hold', () => {
    expect(animationFor('(tabs)', false)).toBe('none');
    expect(animationFor('some-new-screen', false)).toBe('none');
  });

  it('leaves the unlit video call to the navigator', () => {
    expect(animationFor('video/[matchId]', false)).toBe('default');
  });

  it('collapses every transition to a fade under reduce motion', () => {
    expect(animationFor('chat/[matchId]', true)).toBe('fade');
    expect(animationFor('(tabs)/discover', true)).toBe('fade');
  });
});
