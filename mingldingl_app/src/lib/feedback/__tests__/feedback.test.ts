import fs from 'node:fs';
import path from 'node:path';
import * as Haptics from 'expo-haptics';
import spec from '../../../design/figma/motion.json';
import {
  FEEDBACK,
  feedback,
  loadSoundSetting,
  saveSoundSetting,
  setSoundEnabled,
  WORLD_EVENTS,
} from '../index';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(async () => {}),
  notificationAsync: jest.fn(async () => {}),
  ImpactFeedbackStyle: { Soft: 'soft', Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning' },
}));
const mockPlay = jest.fn();
jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn(async () => {}),
  createAudioPlayer: jest.fn(() => ({ play: mockPlay, seekTo: jest.fn(), remove: jest.fn() })),
}));

beforeEach(() => jest.clearAllMocks());

test('every Figma motion with a haptic or sound is a world event', () => {
  const voiced = spec.motions.filter((m) => m.haptic || m.sound).map((m) => m.key);
  for (const k of voiced) expect(WORLD_EVENTS).toContain(k === 'roomTravel' ? 'roomDeeper' : k);
});

test('every sound file the table names exists', () => {
  for (const e of WORLD_EVENTS) {
    const s = FEEDBACK[e].soundFile;
    if (s)
      expect(fs.existsSync(path.join(__dirname, '..', '..', '..', '..', 'assets', 'sounds', s))).toBe(true);
  }
});

test('haptics always fire; sound only when switched on', async () => {
  setSoundEnabled(false);
  await feedback('press');
  expect(Haptics.impactAsync).toHaveBeenCalledWith('soft');
  expect(mockPlay).not.toHaveBeenCalled();
  setSoundEnabled(true);
  await feedback('press');
  expect(mockPlay).toHaveBeenCalledTimes(1);
  setSoundEnabled(false);
});

test('the tier-up strikes twice', async () => {
  await feedback('tierUp');
  expect(Haptics.impactAsync).toHaveBeenCalledTimes(2);
});

test('the sound setting survives a relaunch', async () => {
  await saveSoundSetting(true);
  setSoundEnabled(false);
  await loadSoundSetting();
  await feedback('press');
  expect(mockPlay).toHaveBeenCalled();
  await saveSoundSetting(false);
});
