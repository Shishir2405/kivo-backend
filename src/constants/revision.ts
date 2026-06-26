import { ConfidenceRating } from './enums';

/**
 * Spaced-repetition configuration for the Smart Revision Engine.
 *
 * Intervals are in **days from completion**. The default ladder follows the
 * forgetting-curve spacing described in the PRD (D+3, 7, 15, 30, 60, 90).
 */
export const DEFAULT_REVISION_INTERVALS = [3, 7, 15, 30, 60, 90] as const;

/** Upper bound on how many revisions a single entity can schedule. */
export const MAX_REVISION_INTERVALS = 12;

/** Longest interval (days) we will ever schedule, used to clamp adaptive growth. */
export const MAX_INTERVAL_DAYS = 365;

/**
 * Confidence-based multipliers applied to the *next* interval when a user rates a revision.
 *
 * - `hard`   → revisit sooner (shrink the gap).
 * - `medium` → keep the planned cadence.
 * - `easy`   → stretch the gap (we remember it well).
 */
export const CONFIDENCE_INTERVAL_MULTIPLIER: Record<ConfidenceRating, number> = {
  [ConfidenceRating.HARD]: 0.5,
  [ConfidenceRating.MEDIUM]: 1.0,
  [ConfidenceRating.EASY]: 1.5,
};

/** Hours before a scheduled revision's due time that we consider it "due soon". */
export const REVISION_DUE_SOON_HOURS = 24;

/** Default local hour (24h) at which revision reminders fire if the user has no preference. */
export const DEFAULT_REMINDER_HOUR = 9;
