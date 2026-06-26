import { z } from 'zod';

import {
  MasteryLevel,
  ProblemDifficulty,
  ProblemStatus,
} from '@/constants';

// ── Topics ───────────────────────────────────────────────────────────────

export const createTopicSchema = z
  .object({
    name: z.string().min(1).max(120),
    description: z.string().max(2_000).optional(),
    tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  })
  .strict();
export type CreateTopicInput = z.infer<typeof createTopicSchema>;

export const updateTopicSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    description: z.string().max(2_000).optional(),
    progress: z.number().min(0).max(100).optional(),
    masteryLevel: z.nativeEnum(MasteryLevel).optional(),
    studyTimeMinutes: z.number().int().min(0).optional(),
    tags: z.array(z.string().min(1).max(40)).max(20).optional(),
  })
  .strict();
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;

// ── Problems ─────────────────────────────────────────────────────────────

export const createProblemSchema = z
  .object({
    topicId: z.string().min(1).optional(),
    title: z.string().min(1).max(200),
    platform: z.string().max(60).optional(),
    url: z.string().url().optional(),
    difficulty: z.nativeEnum(ProblemDifficulty).default(ProblemDifficulty.MEDIUM),
    tags: z.array(z.string().min(1).max(40)).max(20).default([]),
    status: z.nativeEnum(ProblemStatus).default(ProblemStatus.NOT_STARTED),
    timeTakenMinutes: z.number().int().min(0).optional(),
    notes: z.string().max(5_000).optional(),
    approach: z.string().max(5_000).optional(),
    timeComplexity: z.string().max(60).optional(),
    spaceComplexity: z.string().max(60).optional(),
    journal: z.string().max(10_000).optional(),
  })
  .strict();
export type CreateProblemInput = z.infer<typeof createProblemSchema>;

export const updateProblemSchema = createProblemSchema.partial().strict();
export type UpdateProblemInput = z.infer<typeof updateProblemSchema>;

export const listProblemsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    topicId: z.string().min(1).optional(),
    status: z.nativeEnum(ProblemStatus).optional(),
    difficulty: z.nativeEnum(ProblemDifficulty).optional(),
  })
  .strict();
export type ListProblemsQuery = z.infer<typeof listProblemsQuerySchema>;

export const listTopicsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();
export type ListTopicsQuery = z.infer<typeof listTopicsQuerySchema>;
