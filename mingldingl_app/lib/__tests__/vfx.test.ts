import { motionAllowed, resolveVfxLevel } from '../vfx';

/**
 * The bug these cover: `reduced` conflated "no Skia here" with "this person asked for less
 * motion", and every particle effect answered `reduced` by rendering nothing — so the vfx layer
 * was blank on the one surface (web) the app is actually developed on.
 */
describe('resolveVfxLevel', () => {
  it('gives native the full Skia treatment', () => {
    expect(resolveVfxLevel('ios', false)).toBe('full');
    expect(resolveVfxLevel('android', false)).toBe('full');
  });

  it('gives web a moving fallback rather than nothing, since it cannot mount a Skia canvas', () => {
    expect(resolveVfxLevel('web', false)).toBe('plain');
  });

  it('lets the reduce-motion setting outrank the platform, on native and on web alike', () => {
    expect(resolveVfxLevel('ios', true)).toBe('still');
    expect(resolveVfxLevel('web', true)).toBe('still');
  });

  it('only lets a level that is not still run a loop', () => {
    expect(motionAllowed('full')).toBe(true);
    expect(motionAllowed('plain')).toBe(true);
    expect(motionAllowed('still')).toBe(false);
    expect(motionAllowed('off')).toBe(false);
  });
});
