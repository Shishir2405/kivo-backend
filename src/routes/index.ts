import { Router } from 'express';

import { authenticate } from '@/middleware/auth.middleware';
import { apiLimiter } from '@/middleware/rateLimiter.middleware';
import { achievementsRouter } from '@/modules/achievements';
import { analyticsRouter } from '@/modules/analytics';
import { authRouter } from '@/modules/auth';
import { dashboardRouter } from '@/modules/dashboard';
import { dsaRouter } from '@/modules/dsa';
import { habitsRouter } from '@/modules/habits';
import { notesRouter } from '@/modules/notes';
import { notificationsRouter } from '@/modules/notifications';
import { reflectionsRouter } from '@/modules/reflections';
import { resourcesRouter } from '@/modules/resources';
import { revisionsRouter } from '@/modules/revisions';
import { studySessionsRouter } from '@/modules/study-sessions';
import { tasksRouter } from '@/modules/tasks';
import { usersRouter } from '@/modules/users';

/**
 * Build the top-level API router mounting every feature module.
 *
 * The default `apiLimiter` is applied to the whole surface. `/auth` is public
 * (it manages its own stricter limiter + selective `authenticate`); every other
 * module router is mounted behind `authenticate`, so handlers can rely on
 * `req.user` being populated.
 */
export function buildRouter(): Router {
  const router: Router = Router();

  router.use(apiLimiter);

  router.use('/auth', authRouter);

  router.use('/users', authenticate, usersRouter);
  router.use('/revisions', authenticate, revisionsRouter);
  router.use('/dsa', authenticate, dsaRouter);
  router.use('/tasks', authenticate, tasksRouter);
  router.use('/notes', authenticate, notesRouter);
  router.use('/resources', authenticate, resourcesRouter);
  router.use('/habits', authenticate, habitsRouter);
  router.use('/study-sessions', authenticate, studySessionsRouter);
  router.use('/reflections', authenticate, reflectionsRouter);
  router.use('/analytics', authenticate, analyticsRouter);
  router.use('/dashboard', authenticate, dashboardRouter);
  router.use('/notifications', authenticate, notificationsRouter);
  router.use('/achievements', authenticate, achievementsRouter);

  return router;
}
