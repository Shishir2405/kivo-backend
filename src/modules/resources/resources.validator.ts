import { z } from 'zod';

export const createResourceSchema = z
  .object({
    topicId: z.string().min(1).optional(),
    title: z.string().min(1).max(200),
    url: z.string().url(),
    type: z.enum(['youtube', 'article', 'pdf', 'github', 'docs', 'other']).default('other'),
    description: z.string().max(2_000).optional(),
    tags: z.array(z.string().min(1).max(40)).max(20).default([]),
    isCompleted: z.boolean().default(false),
  })
  .strict();
export type CreateResourceInput = z.infer<typeof createResourceSchema>;

export const updateResourceSchema = createResourceSchema.partial().strict();
export type UpdateResourceInput = z.infer<typeof updateResourceSchema>;

export const listResourcesQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    topicId: z.string().min(1).optional(),
    type: z.enum(['youtube', 'article', 'pdf', 'github', 'docs', 'other']).optional(),
  })
  .strict();
export type ListResourcesQuery = z.infer<typeof listResourcesQuerySchema>;
