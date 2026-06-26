import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { notificationService } from '@/notifications';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';
import { resolvePagination } from '@/utils/pagination';

export const notificationsController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const pagination = resolvePagination(req.query as Record<string, string | undefined>);
    const result = await notificationService.listForUser(user.uid, pagination);
    ApiResponse.ok(res, result.items, { pagination: result.pagination });
  }),

  markRead: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const notification = await notificationService.markRead(user.uid, req.params.id as string);
    ApiResponse.ok(res, notification);
  }),

  markAllRead: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const updated = await notificationService.markAllRead(user.uid);
    ApiResponse.ok(res, { updated });
  }),

  unreadCount: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const count = await notificationService.unreadCount(user.uid);
    ApiResponse.ok(res, { count });
  }),
};
