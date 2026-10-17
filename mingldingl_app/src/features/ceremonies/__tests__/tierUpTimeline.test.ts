import { AT, beam, flash, newGem, oldGem, shardAt, shards } from '../tierUpTimeline';

describe('the tier-up clock', () => {
  test('the old gem comes out of the dark, trembles only while it cracks, and is gone at the shatter', () => {
    expect(oldGem(0).opacity).toBe(0);
    expect(oldGem(AT.crack).opacity).toBeCloseTo(0.85);
    expect(oldGem(AT.crack).x).toBe(0);
    expect(Math.abs(oldGem(AT.shatter - 50).x) + Math.abs(oldGem(AT.shatter - 50).y)).toBeGreaterThan(0);
    expect(oldGem(AT.shatter).opacity).toBe(0);
  });

  test('the beam drops at the shatter and has folded away once the gem is forged', () => {
    expect(beam(AT.shatter - 1).opacity).toBe(0);
    expect(beam(AT.beamFull).reach).toBe(1);
    expect(beam(AT.forge + 200).width).toBe(0);
    expect(flash(AT.shatter)).toBeGreaterThan(flash(AT.shatter + 200));
  });

  test('the new gem rises onto its place and lands at full size', () => {
    expect(newGem(AT.forge - 1).opacity).toBe(0);
    expect(newGem(AT.forge).y).toBeGreaterThan(80);
    const landed = newGem(AT.risen);
    expect(landed.scale).toBeCloseTo(1);
    expect(landed.y).toBeCloseTo(0);
  });

  test('the shards are the same every time, still before the shatter, gone after', () => {
    expect(shards(5)).toEqual(shards(5));
    const [s] = shards(1);
    if (!s) throw new Error('no shard');
    expect(shardAt(s, AT.crack)).toMatchObject({ x: 0, y: 0, opacity: 0 });
    expect(shardAt(s, AT.shatter + 1500).opacity).toBe(0);
  });
});
