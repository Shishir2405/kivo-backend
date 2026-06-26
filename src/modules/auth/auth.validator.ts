import { z } from 'zod';

/** Register/login both exchange a Firebase ID token for backend session tokens. */
export const firebaseAuthSchema = z
  .object({
    idToken: z.string().min(1, 'idToken is required'),
  })
  .strict();
export type FirebaseAuthInput = z.infer<typeof firebaseAuthSchema>;

export const refreshSchema = z
  .object({
    refreshToken: z.string().min(1, 'refreshToken is required'),
  })
  .strict();
export type RefreshInput = z.infer<typeof refreshSchema>;

export const logoutSchema = z
  .object({
    refreshToken: z.string().min(1).optional(),
    /** Revoke every session, not just the supplied refresh token. */
    allDevices: z.boolean().optional(),
  })
  .strict();
export type LogoutInput = z.infer<typeof logoutSchema>;
