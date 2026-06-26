import type { BaseEntity } from '@/types';

export type ReflectionMood = 'great' | 'good' | 'okay' | 'low' | 'bad';

export interface Reflection extends BaseEntity {
  userId: string;
  /** Day this reflection belongs to — `YYYY-MM-DD`. Unique per user (upsert). */
  dayKey: string;
  /** What the user learned today. */
  learned: string;
  /** What challenged the user today. */
  challenged: string;
  /** Whether the user's goals for the day were completed. */
  goalsCompleted: boolean;
  /** Self-rated focus level, 1 (lowest) to 5 (highest). */
  focusLevel: number;
  /** Self-rated confidence, 1 (lowest) to 5 (highest). */
  confidence: number;
  /** Plan / intentions for tomorrow. */
  tomorrowPlan: string;
  /** Optional overall mood for the day. */
  mood?: ReflectionMood;
}
