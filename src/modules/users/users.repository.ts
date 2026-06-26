import { Collections } from '@/constants';
import { BaseRepository } from '@/repositories/base.repository';

import type { User } from './users.types';

/**
 * User document repository. The document id IS the Firebase uid, so we key by uid
 * everywhere rather than auto-generated ids.
 */
export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(Collections.USERS);
  }

  findByUid(uid: string): Promise<User | null> {
    return this.findById(uid);
  }

  findByEmail(email: string): Promise<User | null> {
    return this.findOne({ filters: [{ field: 'email', op: '==', value: email }] });
  }

  /** List all users (used by batch analytics/maintenance jobs). */
  listAll(limit?: number): Promise<User[]> {
    return this.find(limit !== undefined ? { limit } : {});
  }
}

export const userRepository = new UserRepository();
