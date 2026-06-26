import type { BaseEntity } from '@/types';

export type ResourceType = 'youtube' | 'article' | 'pdf' | 'github' | 'docs' | 'other';

export interface Resource extends BaseEntity {
  userId: string;
  /** Topic this resource is attached to (optional). */
  topicId?: string;
  title: string;
  url: string;
  type: ResourceType;
  description?: string;
  tags: string[];
  isCompleted: boolean;
}
