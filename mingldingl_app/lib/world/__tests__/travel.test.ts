import { animationFor } from '../travel';

/**
 * Every stack screen stands on its own opaque ground (`ScreenGround`), so a transition covers the
 * screen beneath it the way it should. With one shared floor and transparent screens, the War
 * Room and the Character Sheet sat superimposed for the whole platform animation on every push.
 */
describe('travel animation', () => {
  it('cuts between rooms at the same depth — walking across a hall is not travel', () => {
    expect(animationFor('settings', false)).toBe('none');
    expect(animationFor('edit-profile', false)).toBe('none');
    expect(animationFor('progression', false)).toBe('none');
    expect(animationFor('(tabs)/discover', false)).toBe('none');
  });

  it('slides up into a delve', () => {
    expect(animationFor('chat/[matchId]', false)).toBe('slide_from_bottom');
    expect(animationFor('campaign/[matchId]', false)).toBe('slide_from_bottom');
  });

  it('fades everything under reduce-motion', () => {
    expect(animationFor('chat/[matchId]', true)).toBe('fade');
    expect(animationFor('settings', true)).toBe('fade');
  });

  it('leaves the unlit video route to the platform, which composites onto black', () => {
    expect(animationFor('video/[matchId]', false)).toBe('default');
  });
});
