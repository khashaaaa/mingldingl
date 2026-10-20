import fs from 'node:fs';
import path from 'node:path';
import { ROOMS, roomFor } from '../rooms';
import { flakeAt, flakeField } from '../snow';
import { SPARKS_FOR, sparkAt, sparkField } from '../sparks';

const appDir = path.join(__dirname, '..', '..', '..', 'app');
const routes: string[] = [];
const walk = (d: string) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (!e.name.startsWith('_') && !e.name.startsWith('+'))
      routes.push(path.relative(appDir, p).replace(/\.tsx$/, ''));
  }
};
walk(appDir);

test('every route is in a room', () => {
  for (const r of routes) expect({ r, room: roomFor(r.split('/')) }).toEqual({ r, room: expect.any(String) });
});

test('the Gate holds sign-in, Character is in the Forge', () => {
  expect(roomFor(['(out)', 'verify'])).toBe('gate');
  expect(roomFor(['(world)', '(tabs)', 'character'])).toBe('forge');
  expect(roomFor(['(world)', '(tabs)', 'seek'])).toBe('tavern');
  expect(roomFor(['(world)', 'bond', '[id]'])).toBe('tavern');
  expect(roomFor(['(world)', 'frozen-gate'])).toBe('deep');
  expect(roomFor(['(world)', '(tabs)', 'missions'])).toBe('hearth');
});

test('rooms carry a depth for travel feedback', () => {
  expect(ROOMS.deep.depth).toBeGreaterThan(ROOMS.hearth.depth);
});

test('spark count follows the fire', () => {
  expect(SPARKS_FOR.Lit).toBe(14);
  expect(SPARKS_FOR.Roaring).toBe(28);
  expect(SPARKS_FOR.Out).toBe(0);
});

test('the spark field is deterministic for a seed and each spark differs', () => {
  const a = sparkField(7, 14, 390, 550);
  expect(a).toEqual(sparkField(7, 14, 390, 550));
  expect(new Set(a.map((s) => s.speed)).size).toBe(14);
});

test('a spark rises, sways and fades over its life', () => {
  const [s] = sparkField(3, 1, 390, 550);
  if (!s) throw new Error('no spark');
  const start = sparkAt(s, s.delay, 550);
  const mid = sparkAt(s, s.delay + s.life / 2, 550);
  const end = sparkAt(s, s.delay + s.life * 0.99, 550);
  expect(mid.y).toBeLessThan(start.y);
  expect(end.opacity).toBeLessThan(mid.opacity);
  expect(start.opacity).toBeLessThan(mid.opacity);
});

test('snow falls from above the top to the floor and melts away over its last stretch', () => {
  const [f] = flakeField(5, { count: 1, r: [2, 2], speed: [0.05, 0.05], opacity: 1 }, 390, 700);
  if (!f) throw new Error('no flake');
  const life = (700 + f.r * 2) / f.speed;
  const at = (p: number) => flakeAt(f, life * p - f.offset + life, 700, 0.4);
  expect(at(0).y).toBeLessThan(0);
  expect(at(0.5).y).toBeGreaterThan(at(0.1).y);
  expect(at(0.5).r).toBe(2);
  expect(at(0.8).r).toBeCloseTo(1);
  expect(at(0.999).r).toBeLessThan(0.05);
  expect(flakeAt(f, life * 0.999 - f.offset + life, 700, 0).r).toBe(2);
});
