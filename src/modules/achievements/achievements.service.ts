import type { CreateInput } from '@/types';
import { nowIso } from '@/utils/dates';
import { createLogger } from '@/utils/logger';

import { achievementsRepository } from './achievements.repository';
import type {
  Achievement,
  AchievementDefinition,
  AchievementKey,
  AchievementsSummary,
  CatalogEntry,
} from './achievements.types';

const log = createLogger('achievements');

/**
 * Static, code-owned catalog of every definable achievement. Ordered from the
 * earliest milestone to the longest. Jobs award these via {@link AchievementsService.awardIfEligible}.
 */
export const ACHIEVEMENT_CATALOG: readonly AchievementDefinition[] = [
  {
    key: 'first_week',
    title: 'First Week',
    description: 'Stayed consistent for 7 days straight.',
    icon: '🌱',
    xpAwarded: 50,
  },
  {
    key: 'thirty_days',
    title: 'Thirty Days',
    description: 'Kept your streak alive for a full month.',
    icon: '🔥',
    xpAwarded: 200,
  },
  {
    key: 'hundred_days',
    title: 'Hundred Days',
    description: 'Reached a 100-day streak — true dedication.',
    icon: '💯',
    xpAwarded: 750,
  },
  {
    key: 'one_year',
    title: 'One Year',
    description: 'A full year of showing up. Unstoppable.',
    icon: '🏆',
    xpAwarded: 3_000,
  },
];

const CATALOG_BY_KEY: ReadonlyMap<AchievementKey, AchievementDefinition> = new Map(
  ACHIEVEMENT_CATALOG.map((def) => [def.key, def]),
);

export class AchievementsService {
  /** A user's unlocked achievements plus the sum of XP they've earned. */
  async listForUser(userId: string): Promise<AchievementsSummary> {
    const achievements = await achievementsRepository.listForUserByUnlocked(userId);
    const totalXp = achievements.reduce((sum, a) => sum + a.xpAwarded, 0);
    return { achievements, totalXp };
  }

  /** The full catalog annotated with this user's locked/unlocked status. */
  async catalogForUser(userId: string): Promise<CatalogEntry[]> {
    const unlocked = await achievementsRepository.listForUser(userId);
    const unlockedByKey = new Map<AchievementKey, Achievement>(
      unlocked.map((a) => [a.key, a]),
    );

    return ACHIEVEMENT_CATALOG.map((def) => {
      const earned = unlockedByKey.get(def.key);
      return {
        ...def,
        unlocked: earned !== undefined,
        unlockedAt: earned ? earned.unlockedAt : null,
      };
    });
  }

  /**
   * Award an achievement to a user if they don't already have it. Invoked by
   * background jobs when a milestone (streak length, etc.) is reached.
   *
   * Idempotent: a user can only ever hold one document per key, so re-running a
   * job — or two jobs racing — never double-awards. Returns the existing record
   * when already unlocked, or `null` for an unknown key.
   */
  async awardIfEligible(userId: string, key: AchievementKey): Promise<Achievement | null> {
    const definition = CATALOG_BY_KEY.get(key);
    if (!definition) {
      log.warn({ userId, key }, 'Attempted to award unknown achievement key');
      return null;
    }

    const existing = await achievementsRepository.findByKey(userId, key);
    if (existing) return existing;

    const payload: CreateInput<Achievement> = {
      userId,
      key: definition.key,
      title: definition.title,
      description: definition.description,
      icon: definition.icon,
      unlockedAt: nowIso(),
      xpAwarded: definition.xpAwarded,
    };

    // Use the key as a deterministic doc id (`<userId>__<key>`) so concurrent
    // awards collapse to the same document rather than creating duplicates.
    const docId = `${userId}__${key}`;
    const created = await achievementsRepository.create(payload, docId);
    log.info({ userId, key, xpAwarded: created.xpAwarded }, 'Achievement unlocked');
    return created;
  }
}

export const achievementsService = new AchievementsService();
