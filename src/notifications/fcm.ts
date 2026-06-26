import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';

import { config } from '@/config';
import { getFirebaseApp } from '@/firebase/admin';
import { createLogger } from '@/utils/logger';

import { deviceTokenRepository } from './deviceToken.repository';
import type { NotificationContent } from './notification.types';

const log = createLogger('fcm');

/** FCM error codes that mean a token is permanently invalid and should be pruned. */
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export interface SendResult {
  successCount: number;
  failureCount: number;
  /** Tokens that were invalid and have been pruned from storage. */
  prunedTokens: string[];
}

function messaging() {
  return getMessaging(getFirebaseApp());
}

/**
 * Multicast a push to a set of device tokens. Returns success/failure counts and
 * prunes tokens FCM reports as unregistered/invalid so future sends stay clean.
 */
export async function sendToTokens(
  tokens: string[],
  content: NotificationContent,
): Promise<SendResult> {
  const unique = [...new Set(tokens.filter(Boolean))];
  if (unique.length === 0) {
    return { successCount: 0, failureCount: 0, prunedTokens: [] };
  }

  if (config.isTest) {
    log.debug({ count: unique.length }, 'Skipping FCM send in test mode');
    return { successCount: unique.length, failureCount: 0, prunedTokens: [] };
  }

  const message: MulticastMessage = {
    tokens: unique,
    notification: { title: content.title, body: content.body },
    data: content.data,
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } },
  };

  try {
    const response = await messaging().sendEachForMulticast(message);
    const prunedTokens: string[] = [];

    response.responses.forEach((res, idx) => {
      if (!res.success && res.error) {
        const code = res.error.code;
        const token = unique[idx];
        if (token && INVALID_TOKEN_CODES.has(code)) {
          prunedTokens.push(token);
        } else {
          log.warn({ code, message: res.error.message }, 'FCM send failure');
        }
      }
    });

    if (prunedTokens.length > 0) {
      await deviceTokenRepository.pruneTokens(prunedTokens).catch((err) => {
        log.error({ err }, 'Failed to prune invalid device tokens');
      });
    }

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      prunedTokens,
    };
  } catch (err) {
    log.error({ err }, 'FCM multicast send failed');
    return { successCount: 0, failureCount: unique.length, prunedTokens: [] };
  }
}

/** Resolve a user's device tokens and push the content to all of them. */
export async function sendToUser(
  userId: string,
  content: NotificationContent,
): Promise<SendResult> {
  const devices = await deviceTokenRepository.listTokensForUser(userId);
  const tokens = devices.map((d) => d.token);
  return sendToTokens(tokens, content);
}
