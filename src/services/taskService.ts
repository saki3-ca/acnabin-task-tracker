import { Task, TaskFilter } from '../types';
import { api } from './api';

export const taskService = {
  async getMyTasks(userId?: string): Promise<Task[]> {
    return api.callBackend('getMyTasks', { userId });
  },

  async getTeamTasks(userId?: string, filters: TaskFilter = {}): Promise<Task[]> {
    return api.callBackend('getTeamTasks', { userId, filters });
  },

  async createTask(taskData: Partial<Task>): Promise<Task> {
    return api.callBackend('createTask', taskData);
  },

  /** One email per assignee, sent by the server after a bulk assignment. Never throws. */
  async emailAssigned(taskIds: string[]): Promise<void> {
    try {
      // the server accepts at most 80 per call
      for (let i = 0; i < taskIds.length; i += 50) {
        await api.callBackend('sendTaskEmail', { event: 'TASK_ASSIGNED', ids: taskIds.slice(i, i + 50) });
      }
    } catch {
      /* email is best-effort */
    }
  },

  async updateTask(taskId: string, updates: Partial<Task>): Promise<Task> {
    return api.callBackend('updateTask', { taskId, updates });
  },

  async deleteTask(taskId: string): Promise<void> {
    await api.callBackend('deleteTask', { taskId });
  },

  async addManagerComment(taskId: string, comment: string): Promise<Task> {
    return api.callBackend('addManagerComment', { taskId, comment });
  }
};
