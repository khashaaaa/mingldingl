/**
 * Client-side caps. Every value here is at or below the engine's `DTOs/FieldLimits.cs`, which
 * is the hard ceiling; `bio` is deliberately tighter (the engine allows 1000, shared with
 * business descriptions) because a bio is read on a card, not a page.
 */
export const FIELD_LIMITS = {
  displayName: 64,
  bio: 200,
  message: 2000,
  minAge: 18,
  maxAge: 99,
  maxPhotos: 6,
} as const;
