import type { CreateInput, PaginatedResult } from '@/types';
import { ApiError } from '@/utils/ApiError';
import { buildPaginatedResult } from '@/utils/pagination';

import { noteRepository } from './notes.repository';
import type { Note } from './notes.types';
import type { CreateNoteInput, ListNotesQuery, UpdateNoteInput } from './notes.validator';

/** Lightweight client-side text match (Firestore lacks full-text search). */
function matchesSearch(note: Note, term: string): boolean {
  const needle = term.toLowerCase();
  return (
    note.title.toLowerCase().includes(needle) ||
    note.content.toLowerCase().includes(needle) ||
    note.tags.some((t) => t.toLowerCase().includes(needle))
  );
}

export class NoteService {
  async create(userId: string, input: CreateNoteInput): Promise<Note> {
    const payload: CreateInput<Note> = {
      userId,
      title: input.title,
      content: input.content,
      tags: input.tags,
      isFavorite: input.isFavorite,
      isPinned: input.isPinned,
      isArchived: input.isArchived,
    };
    if (input.folder !== undefined) payload.folder = input.folder;
    return noteRepository.create(payload);
  }

  /**
   * List notes with filtering + optional free-text search. When `search` is set we
   * fetch the user's notes and filter in memory (acceptable at per-user scale).
   */
  async list(userId: string, query: ListNotesQuery): Promise<PaginatedResult<Note>> {
    const filters = [];
    if (query.folder) filters.push({ field: 'folder', op: '==' as const, value: query.folder });
    if (typeof query.favorite === 'boolean') {
      filters.push({ field: 'isFavorite', op: '==' as const, value: query.favorite });
    }
    if (typeof query.pinned === 'boolean') {
      filters.push({ field: 'isPinned', op: '==' as const, value: query.pinned });
    }
    filters.push({
      field: 'isArchived',
      op: '==' as const,
      value: query.archived ?? false,
    });

    const pagination = { page: query.page, limit: query.limit };

    if (!query.search) {
      return noteRepository.paginateForUser(userId, pagination, {
        filters,
        orderBy: { field: 'updatedAt', direction: 'desc' },
      });
    }

    const all = await noteRepository.listForUser(userId, { filters });
    const matched = all
      .filter((n) => matchesSearch(n, query.search as string))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const start = (pagination.page - 1) * pagination.limit;
    return buildPaginatedResult(
      matched.slice(start, start + pagination.limit),
      matched.length,
      pagination,
    );
  }

  async getById(userId: string, id: string): Promise<Note> {
    const note = await noteRepository.findByIdForUser(id, userId);
    if (!note) throw ApiError.notFound('Note not found');
    return note;
  }

  async update(userId: string, id: string, input: UpdateNoteInput): Promise<Note> {
    await this.getById(userId, id);
    const updated = await noteRepository.update(id, input as Partial<Note>);
    if (!updated) throw ApiError.notFound('Note not found');
    return updated;
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.getById(userId, id);
    await noteRepository.delete(id);
  }
}

export const noteService = new NoteService();
