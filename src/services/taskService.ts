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
