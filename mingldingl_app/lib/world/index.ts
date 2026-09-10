/**
 * Build-time kill switch for the whole world layer — light, atlas, travel and feedback.
 *
 * Deliberately not admin config: the app has no generic config-read path (tier and reveal
 * thresholds each got their own endpoint), and a cosmetic layer does not justify inventing one.
 * Flipping this is a release, not a toggle.
 */
export const WORLD_ENABLED = true;

/** One speed for every light change in the hold that is *losing* light. */
export const LIGHT_FADE_MS = 600;

/**
 * How light arrives, as opposed to how it leaves.
 *
 * A room getting brighter and a room getting dimmer are not the same event: a match landing, a
 * delve room cleared, an honour earned are all *news*, and news that eases in over a flat 600ms
 * reads as the UI catching up rather than as something happening. Rising light springs instead,
 * overshooting a little and settling — so the Hearth swells when a match arrives.
 *
 * Falling light keeps the plain fade. A room dimming that dips past its target and bounces back
 * looks like a bug, and losing something should not be given a flourish.
 *
 * The overshoot is free of consequences: every consumer clamps to 0..1 before using the value.
 */
export const LIGHT_SPRING = { damping: 11, stiffness: 90, mass: 1 } as const;

export * from './light';
export * from './rooms';
