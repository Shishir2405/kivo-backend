import type { Request, Response } from 'express';

import { requireUser } from '@/middleware/auth.middleware';
import { ApiResponse } from '@/utils/ApiResponse';
import { asyncHandler } from '@/utils/asyncHandler';

import { authService } from './auth.service';
import type { FirebaseAuthInput, LogoutInput, RefreshInput } from './auth.validator';

function userAgentOf(req: Request): string | undefined {
  return req.header('User-Agent') ?? undefined;
}

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const { idToken } = req.body as FirebaseAuthInput;
    const result = await authService.register(idToken, userAgentOf(req));
    ApiResponse.created(res, result);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const { idToken } = req.body as FirebaseAuthInput;
    const result = await authService.login(idToken, userAgentOf(req));
    ApiResponse.ok(res, result);
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken } = req.body as RefreshInput;
    const tokens = await authService.refresh(refreshToken, userAgentOf(req));
    ApiResponse.ok(res, tokens);
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const body = req.body as LogoutInput;
    await authService.logout(user.uid, {
      refreshToken: body.refreshToken,
      allDevices: body.allDevices,
    });
    ApiResponse.noContent(res);
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = requireUser(req);
    const profile = await authService.me(user.uid);
    ApiResponse.ok(res, profile);
  }),
};
