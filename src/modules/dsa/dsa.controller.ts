import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

import { dsaService } from './dsa.service';
import type {
  CreateProblemInput,
  CreateTopicInput,
  ListProblemsQuery,
  ListTopicsQuery,
  UpdateProblemInput,
  UpdateTopicInput,
} from './dsa.validator';

export const dsaController = {
  // Topics
  createTopic: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const topic = await dsaService.createTopic(user.uid, req.body as CreateTopicInput);
    ApiResponse.created(res, topic);
  }),

  listTopics: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await dsaService.listTopics(
      user.uid,
      req.query as unknown as ListTopicsQuery,
    );
    ApiResponse.ok(res, result.items, { pagination: result.pagination });
  }),

  getTopic: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const topic = await dsaService.getTopic(user.uid, req.params.id as string);
    ApiResponse.ok(res, topic);
  }),

  updateTopic: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const topic = await dsaService.updateTopic(
      user.uid,
      req.params.id as string,
      req.body as UpdateTopicInput,
    );
    ApiResponse.ok(res, topic);
  }),

  completeTopic: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const topic = await dsaService.completeTopic(user.uid, req.params.id as string);
    ApiResponse.ok(res, topic);
  }),

  deleteTopic: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    await dsaService.deleteTopic(user.uid, req.params.id as string);
    ApiResponse.noContent(res);
  }),

  // Problems
  createProblem: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const problem = await dsaService.createProblem(user.uid, req.body as CreateProblemInput);
    ApiResponse.created(res, problem);
  }),

  listProblems: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const result = await dsaService.listProblems(
      user.uid,
      req.query as unknown as ListProblemsQuery,
    );
    ApiResponse.ok(res, result.items, { pagination: result.pagination });
  }),

  getProblem: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const problem = await dsaService.getProblem(user.uid, req.params.id as string);
    ApiResponse.ok(res, problem);
  }),

  updateProblem: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const problem = await dsaService.updateProblem(
      user.uid,
      req.params.id as string,
      req.body as UpdateProblemInput,
    );
    ApiResponse.ok(res, problem);
  }),

  deleteProblem: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    await dsaService.deleteProblem(user.uid, req.params.id as string);
    ApiResponse.noContent(res);
  }),
};
