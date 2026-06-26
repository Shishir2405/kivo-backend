import type {
  ConfidenceRating,
  RevisionEntityType,
  RevisionStatus,
} from '@/constants';
import type { BaseEntity } from '@/types';

/**
 * A single spaced-repetition revision occurrence for a topic or problem.
 * One entity (e.g. a solved problem) spawns several revisions at increasing intervals.
 */
export interface Revision extends BaseEntity {
  userId: string;
  entityType: RevisionEntityType;
  entityId: string;
  /** Denormalised title for list rendering + notification copy. */
  entityTitle: string;
  /** Which step in the interval ladder this is (1-based). */
  intervalIndex: number;
  /** The interval (days) this revision was scheduled at. */
  intervalDays: number;
  /** When this revision becomes due (ISO). */
  dueAt: string;
  status: RevisionStatus;
  /** User's confidence rating recorded on completion. */
  confidence?: ConfidenceRating;
  completedAt?: string;
  /** Optional revision notes captured by the user. */
  notes?: string;
  /** Number of times this revision was snoozed. */
  snoozeCount: number;
}
