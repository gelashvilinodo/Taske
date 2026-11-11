import type { Comment, ProjectFields, ProjectPatch, TaskFields, TaskPatch } from '@/lib/tasks/model';

/** Raw records as the backend returns them; normalised later by cleanTask. */
export type RawTask = { id: string } & Record<string, unknown>;
export type RawProject = { id: string } & Record<string, unknown>;
export type Table = 'tasks' | 'comments' | 'projects';

/** missing_table: the database has not been set up for this feature yet (a migration was not run). */
export interface StoreError { code: 'unavailable' | 'quota_exceeded' | 'forbidden' | 'missing_table' | 'unknown'; message?: string }

/**
 * Persistence for tasks, comments and projects. Two implementations: Supabase (signed-in, synced)
 * and the browser (local mode, used when Supabase is not configured).
 */
export interface TaskStore {
  kind: 'supabase' | 'local';
  loadTasks(): Promise<RawTask[]>;
  loadComments(): Promise<Comment[]>;
  loadProjects(): Promise<RawProject[]>;
  /** Calls back when data changed elsewhere (another tab or device). Returns an unsubscribe. */
  watch(onChange: (table: Table) => void): () => void;
  insertTask(id: string, fields: TaskFields): Promise<void>;
  updateTask(id: string, patch: TaskPatch): Promise<void>;
  deleteTask(id: string): Promise<void>;
  insertComment(c: Comment): Promise<void>;
  deleteComment(id: string): Promise<void>;
  insertProject(id: string, fields: ProjectFields): Promise<void>;
  updateProject(id: string, patch: ProjectPatch): Promise<void>;
  /** Deletes the project and clears it from every task that used it. */
  deleteProject(id: string): Promise<void>;
}
