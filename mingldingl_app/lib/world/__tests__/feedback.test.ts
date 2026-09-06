import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import * as Audio from 'expo-audio';
import { __resetFeedback, setFeedbackMuted, setSoundEnabled, signal } from '../feedback';
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

  it('leaves movement inside the hold alone', () => {
    expect(animationFor('(tabs)/discover', false)).toBe('default');
    expect(animationFor('edit-profile', false)).toBe('default');
  });

  it('does not animate a route with no place in the hold', () => {
    expect(animationFor('(tabs)', false)).toBe('default');
    expect(animationFor('some-new-screen', false)).toBe('default');
  });

  it('leaves the unlit video call to the navigator', () => {
    expect(animationFor('video/[matchId]', false)).toBe('default');
  });

  it('collapses every transition to a fade under reduce motion', () => {
    expect(animationFor('chat/[matchId]', true)).toBe('fade');
    expect(animationFor('(tabs)/discover', true)).toBe('fade');
  });
});
