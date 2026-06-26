import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { authLimiter } from '@/middleware/rateLimiter.middleware';
import { validate } from '@/middleware/validate.middleware';

import { authController } from './auth.controller';
import { firebaseAuthSchema, logoutSchema, refreshSchema } from './auth.validator';

/**
 * Routes mounted at `/auth`. These are public (no `authenticate`) except logout/me,
 * and are protected by the stricter auth rate limiter.
 */
export const authRouter: Router = Router();

authRouter.post(
  '/register',
  authLimiter,
  validate(firebaseAuthSchema),
  authController.register,
);
authRouter.post('/login', authLimiter, validate(firebaseAuthSchema), authController.login);
authRouter.post('/refresh', authLimiter, validate(refreshSchema), authController.refresh);

authRouter.post('/logout', authenticate, validate(logoutSchema), authController.logout);
authRouter.get('/me', authenticate, authController.me);
