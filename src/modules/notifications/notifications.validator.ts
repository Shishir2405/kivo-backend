import { z } from 'zod';

export const listNotificationsQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
  })
  .strict();
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

/**
 * Body for `POST /notifications/test` — lets an authenticated user send a custom
 * push to themselves. Handy for verifying real device (FCM) delivery end-to-end.
 */
export const testNotificationSchema = z.preprocess(
  // Tolerate an empty/absent body (e.g. `POST` with no JSON) — defaults apply.
  (val) => (val === undefined || val === null ? {} : val),
  z
    .object({
      title: z.string().trim().min(1).max(120).default('Test notification'),
      body: z
        .string()
        .trim()
        .min(1)
        .max(500)
        .default('This is a test push from Kivo. If you can see this, delivery works.'),
    })
    .strict(),
);
export type TestNotificationInput = z.infer<typeof testNotificationSchema>;
