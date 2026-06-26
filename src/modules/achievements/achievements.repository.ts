import { Collections } from '@/constants';
import { UserScopedRepository } from '@/repositories/base.repository';

import type { Achievement, AchievementKey } from './achievements.types';

export class AchievementsRepository extends UserScopedRepository<Achievement> {
  constructor() {
    super(Collections.ACHIEVEMENTS);
  }

  /** A user's unlocked achievements, most recently unlocked first. */
  async listForUserByUnlocked(userId: string): Promise<Achievement[]> {
    return this.listForUser(userId, {
      orderBy: { field: 'unlockedAt', direction: 'desc' },
    });
  }

  /** Look up a single unlocked achievement by its key (idempotency check). */
  async findByKey(userId: string, key: AchievementKey): Promise<Achievement | null> {
    return this.findOne({
      filters: [
        { field: 'userId', op: '==', value: userId },
        { field: 'key', op: '==', value: key },
      ],
    });
  }
}

export const achievementsRepository = new AchievementsRepository();
