import { Collections } from '@/constants';
import { UserScopedRepository } from '@/repositories/base.repository';

import type { Habit, HabitFrequency } from './habits.types';

export class HabitsRepository extends UserScopedRepository<Habit> {
  constructor() {
    super(Collections.HABITS);
  }

  /** All non-archived habits for a user, newest first. */
  async findActive(userId: string): Promise<Habit[]> {
    return this.listForUser(userId, {
      filters: [{ field: 'isArchived', op: '==', value: false }],
      orderBy: { field: 'createdAt', direction: 'desc' },
    });
  }

  /** Habits matching a given frequency for a user. */
  async findByFrequency(userId: string, frequency: HabitFrequency): Promise<Habit[]> {
    return this.listForUser(userId, {
      filters: [{ field: 'frequency', op: '==', value: frequency }],
    });
  }
}

export const habitsRepository = new HabitsRepository();
