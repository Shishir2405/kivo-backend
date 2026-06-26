import type { BaseEntity } from '@/types';

/** Stable identifiers for every definable achievement. */
export type AchievementKey =
  | 'first_week'
  | 'thirty_days'
  | 'hundred_days'
  | 'one_year';

/**
 * A milestone definition. The catalog is static (code-owned), so titles, copy,
 * icons and XP rewards stay consistent across users and can evolve without a
 * data migration. Awarded records snapshot the relevant fields at unlock time.
 */
export interface AchievementDefinition {
  key: AchievementKey;
  title: string;
  description: string;
  icon: string;
  /** XP granted when this achievement is unlocked. */
  xpAwarded: number;
}

/** An achievement a user has actually unlocked (one document per user+key). */
export interface Achievement extends BaseEntity {
  userId: string;
  key: AchievementKey;
  title: string;
  description: string;
  icon: string;
  /** When the user unlocked it (ISO-8601). */
  unlockedAt: string;
  xpAwarded: number;
}

/** A catalog entry annotated with the requesting user's unlock state. */
export interface CatalogEntry extends AchievementDefinition {
  unlocked: boolean;
  /** ISO timestamp if unlocked, otherwise `null`. */
  unlockedAt: string | null;
}

/** Response shape for the earned-achievements list endpoint. */
export interface AchievementsSummary {
  achievements: Achievement[];
  totalXp: number;
}
