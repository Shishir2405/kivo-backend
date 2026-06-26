import { Collections } from '@/constants';
import { UserScopedRepository } from '@/repositories/base.repository';

import type { Reflection } from './reflections.types';

export class ReflectionsRepository extends UserScopedRepository<Reflection> {
  constructor() {
    super(Collections.REFLECTIONS);
  }

  /** Find the single reflection a user owns for a given day, or null. */
  findByDay(userId: string, dayKey: string): Promise<Reflection | null> {
    return this.findOne({
      filters: [
        { field: 'userId', op: '==', value: userId },
        { field: 'dayKey', op: '==', value: dayKey },
      ],
    });
  }
}

export const reflectionsRepository = new ReflectionsRepository();
