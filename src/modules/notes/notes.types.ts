import type { BaseEntity } from '@/types';

export interface Note extends BaseEntity {
  userId: string;
  title: string;
  /** Markdown / rich content body. */
  content: string;
  tags: string[];
  /** Optional folder/notebook grouping. */
  folder?: string;
  isFavorite: boolean;
  isPinned: boolean;
  isArchived: boolean;
}
