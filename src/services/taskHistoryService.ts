import { api } from './api';

export interface TaskHistoryEntry {
  id: number;
  taskId: string;
  action: 'CREATED' | 'UPDATED' | 'DELETED';
  particular: string | null;
  clientName: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  changes: Record<string, { from?: string | null; to?: string | null }>;
  changedByName: string | null;
  changed_at: string;
}

export const taskHistoryService = {
  /** Admin only. userId = only that person's tasks; onlyStatus = only status changes. Newest first. */
  async get(opts: { userId?: string; onlyStatus?: boolean; limit?: number } = {}): Promise<TaskHistoryEntry[]> {
    return api.callBackend('taskHistoryGet', opts);
  }
};
