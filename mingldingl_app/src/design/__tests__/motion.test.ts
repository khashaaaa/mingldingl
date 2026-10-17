import spec from '../figma/motion.json';
import { MOTION, type MotionName } from '../motion';

test('every Figma motion is in the table', () => {
  expect(Object.keys(MOTION).sort()).toEqual(spec.motions.map((m) => m.key).sort());
});

test('durations come from the five Figma durations', () => {
  expect(MOTION.press.duration).toBe(120);
  expect(MOTION.dryBrushDraw.duration).toBe(480);
  expect(MOTION.sealStamp.duration).toBe(600);
  expect(MOTION.rewardBurst.duration).toBe(1440);
  expect(MOTION.emberDrift.loop).toEqual({ min: 4000, max: 6000 });
});

test('reduce motion: loops stop, ceremonies cut to the end, the rest fade (M7)', () => {
  const r = (n: MotionName) => MOTION[n].reduced;
  expect(r('candle')).toBe('stop');
  expect(r('gemIdle')).toBe('stop');
  expect(r('tierUp')).toBe('lastFrame');
  expect(r('sealStamp')).toBe('lastFrame');
  expect(r('sheetRise')).toBe('fade');
});

test('exits are 75% of entrances (M3)', () => {
  expect(MOTION.sheetRise.exit).toBe(270);
});
