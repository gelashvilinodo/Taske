import type { Comment, TaskFields, TaskPatch } from '@/lib/tasks/model';

/** Raw records as the backend returns them; normalised later by cleanTask. */
export type RawTask = { id: string } & Record<string, unknown>;

export interface StoreError { code: 'unavailable' | 'quota_exceeded' | 'forbidden' | 'unknown'; message?: string }

/**
 * Persistence for tasks and comments. Two implementations: Supabase (signed-in, synced)
 * and the browser (local mode, used when Supabase is not configured).
 */
export interface TaskStore {
  kind: 'supabase' | 'local';
  loadTasks(): Promise<RawTask[]>;
  loadComments(): Promise<Comment[]>;
  /** Calls back when data changed elsewhere (another tab or device). Returns an unsubscribe. */
  watch(onChange: (table: 'tasks' | 'comments') => void): () => void;
  insertTask(id: string, fields: TaskFields): Promise<void>;
  updateTask(id: string, patch: TaskPatch): Promise<void>;
  deleteTask(id: string): Promise<void>;
  insertComment(c: Comment): Promise<void>;
  deleteComment(id: string): Promise<void>;
}
