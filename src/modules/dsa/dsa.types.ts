import type { MasteryLevel, ProblemDifficulty, ProblemStatus } from '@/constants';
import type { BaseEntity } from '@/types';

/** A DSA topic (e.g. "Graphs", "Dynamic Programming"). */
export interface DsaTopic extends BaseEntity {
  userId: string;
  name: string;
  description?: string;
  /** 0-100 completion percentage. */
  progress: number;
  masteryLevel: MasteryLevel;
  /** Accumulated study time on this topic, in minutes. */
  studyTimeMinutes: number;
  /** Total / completed problem counts (denormalised for fast topic cards). */
  totalProblems: number;
  completedProblems: number;
  tags: string[];
  isCompleted: boolean;
  completedAt?: string;
}

/** A DSA problem the user is tracking. */
export interface DsaProblem extends BaseEntity {
  userId: string;
  topicId?: string;
  title: string;
  platform?: string;
  url?: string;
  difficulty: ProblemDifficulty;
  tags: string[];
  status: ProblemStatus;
  /** Minutes spent solving. */
  timeTakenMinutes?: number;
  dateSolved?: string;
  // ── Coding journal fields ──
  notes?: string;
  approach?: string;
  timeComplexity?: string;
  spaceComplexity?: string;
  /** Free-form journal/reflection on the solution. */
  journal?: string;
  isCompleted: boolean;
}
