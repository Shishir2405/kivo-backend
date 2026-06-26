import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';

import { resolveFirebaseCredentials } from '@/config/env';
import { createLogger } from '@/utils/logger';

const log = createLogger('firebase');

let app: App | null = null;

/**
 * Initialise the Firebase Admin SDK exactly once (idempotent across hot reloads).
 *
 * In `test` we allow a missing service account so unit tests don't require real
 * credentials — callers that actually touch Firestore should mock it.
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
    log.warn('Firebase credentials not configured — Admin SDK not initialised (test mode only)');
    // Initialise an app without credentials so the SDK can still be referenced in tests.
    app = initializeApp();
    return app;
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
