import motion from '../figma/motion.json';
import { color, dimension, duration, easing, effect, primitive, type, typeMn } from '../tokens';

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/;

test('every colour is a hex value', () => {
  for (const v of [...Object.values(color), ...Object.values(primitive)]) expect(v).toMatch(HEX);
});

test('semantic colours resolve through their primitives', () => {
  expect(color.bgBase).toBe('#060912');
  expect(color.accentGold).toBe(primitive.gold500);
  expect(color.gemRubyGlow).toBe('#ff4a5e');
});

test('brass exists and iron does not', () => {
  expect(color.metalBrass).toBeDefined();
  expect(Object.keys({ ...color, ...primitive }).some((k) => k.toLowerCase().includes('iron'))).toBe(false);
});

test('room titles are blackletter in English and Yeseva One in Mongolian', () => {
  expect(type.titleRoom.fontFamily).toBe('PirataOne_400Regular');
  expect(typeMn.titleRoom.fontFamily).toBe('YesevaOne_400Regular');
  expect(typeMn.bodyM).toEqual(type.bodyM);
});

test('labels are uppercase with letter spacing in points', () => {
  expect(type.labelM.textTransform).toBe('uppercase');
  expect(type.labelM.letterSpacing).toBeCloseTo(14 * 0.08);
  expect(type.voiceM.fontFamily).toBe('EBGaramond_400Regular_Italic');
});

test('dimensions and motion come from Figma', () => {
  expect(dimension.space4).toBe(16);
  expect(dimension.sizeTouch).toBe(48);
  expect(duration.tap).toBe(motion.durations.tap);
  expect(duration.exit(360)).toBe(270);
  expect(easing.forgeOut).toEqual([0.16, 1, 0.3, 1]);
  expect(easing.anvil).toEqual({ damping: 14, stiffness: 180 });
});

test('effects carry colour and opacity', () => {
  expect(effect.glowGold[0]).toMatchObject({ radius: 18, color: '#d9a21b', opacity: 0.55 });
});
