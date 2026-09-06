/**
 * Build-time kill switch for the whole world layer — light, atlas, travel and feedback.
 *
 * Deliberately not admin config: the app has no generic config-read path (tier and reveal
 * thresholds each got their own endpoint), and a cosmetic layer does not justify inventing one.
 * Flipping this is a release, not a toggle.
 */
export const WORLD_ENABLED = true;

/** One speed for every light change in the hold. */
export const LIGHT_FADE_MS = 600;

export * from './light';
export * from './rooms';
