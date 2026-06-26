/**
 * Canonical Firestore collection names. Centralised so a rename is a one-line change
 * and typos become compile errors instead of silent empty queries.
 */
export const Collections = {
  USERS: 'users',
  DSA_TOPICS: 'dsa_topics',
  PROBLEMS: 'problems',
  REVISIONS: 'revisions',
  NOTES: 'notes',
  RESOURCES: 'resources',
  TASKS: 'tasks',
  HABITS: 'habits',
  STUDY_SESSIONS: 'study_sessions',
  REFLECTIONS: 'reflections',
  ANALYTICS: 'analytics',
  NOTIFICATIONS: 'notifications',
  ACHIEVEMENTS: 'achievements',
  DEVICE_TOKENS: 'device_tokens',
  REFRESH_TOKENS: 'refresh_tokens',
} as const;

export type CollectionName = (typeof Collections)[keyof typeof Collections];
