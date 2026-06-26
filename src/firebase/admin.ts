import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';

import { isTest, resolveFirebaseCredentials } from '@/config/env';
import { ApiError } from '@/utils/ApiError';
import { createLogger } from '@/utils/logger';

const log = createLogger('firebase');

let app: App | null = null;

/**
 * Initialise the Firebase Admin SDK exactly once (idempotent across hot reloads).
 *
 * Lazy by design: nothing here runs at import. The app can boot (and serve
 * `/health`) without Firebase configured; the SDK is initialised on the first
 * Firestore access. When credentials are missing outside of `test`, we throw a
 * clean 503 (`SERVICE_UNAVAILABLE`) which the error middleware turns into a tidy
 * JSON response instead of a crash. In `test` we allow a no-cred app so unit
 * tests don't require real credentials — callers that touch Firestore should mock it.
 */
export function initFirebase(): App {
  if (app) return app;

  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0]!;
    return app;
  }

  const creds = resolveFirebaseCredentials();
  if (!creds) {
    if (isTest) {
      log.warn('Firebase credentials not configured — initialising no-cred app (test mode)');
      // Initialise an app without credentials so the SDK can still be referenced in tests.
      app = initializeApp();
      return app;
    }
    log.error('Firebase credentials not configured — Firestore is unavailable');
    throw ApiError.serviceUnavailable(
      'Firestore is not configured on the server (missing Firebase credentials)',
    );
  }

  app = initializeApp({
    credential: cert({
      projectId: creds.projectId,
      clientEmail: creds.clientEmail,
      privateKey: creds.privateKey,
    }),
    projectId: creds.projectId,
  });

  log.info({ projectId: creds.projectId }, 'Firebase Admin SDK initialised');
  return app;
}

export function getFirebaseApp(): App {
  return app ?? initFirebase();
}
