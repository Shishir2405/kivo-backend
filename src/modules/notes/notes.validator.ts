import { z } from 'zod';

export const createNoteSchema = z
  .object({
    title: z.string().min(1).max(200),
    content: z.string().max(100_000).default(''),
    tags: z.array(z.string().min(1).max(40)).max(30).default([]),
    folder: z.string().min(1).max(100).optional(),
    isFavorite: z.boolean().default(false),
    isPinned: z.boolean().default(false),
    isArchived: z.boolean().default(false),
  })
  .strict();
export type CreateNoteInput = z.infer<typeof createNoteSchema>;

export const updateNoteSchema = createNoteSchema.partial().strict();
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const listNotesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    folder: z.string().min(1).max(100).optional(),
    /** Free-text search across title/content/tags. */
    search: z.string().min(1).max(200).optional(),
    favorite: z.coerce.boolean().optional(),
    pinned: z.coerce.boolean().optional(),
    archived: z.coerce.boolean().optional(),
  })
  .strict();
export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;
