import { Collections } from '@/constants';
import { UserScopedRepository } from '@/repositories/base.repository';

import type { Note } from './notes.types';

export class NoteRepository extends UserScopedRepository<Note> {
  constructor() {
    super(Collections.NOTES);
  }

  listByFolder(userId: string, folder: string): Promise<Note[]> {
    return this.listForUser(userId, {
      filters: [{ field: 'folder', op: '==', value: folder }],
    });
  }
}

export const noteRepository = new NoteRepository();
