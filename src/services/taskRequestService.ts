import { TaskRequest } from '../types';
import { api } from './api';

export const taskRequestService = {
  async getTaskRequests(userId: string): Promise<TaskRequest[]> {
    return api.callBackend('getTaskRequests', { userId });
  },

  async createTaskRequest(payload: {
    requesterId: string;
    requesterName: string;
    superiorId: string;
    superiorName: string;
    clientId: string;
    clientName: string;
    particular: string;
    priority?: string;
    deadline?: string;
    notes?: string;
  }): Promise<TaskRequest> {
    return api.callBackend('createTaskRequest', payload);
  },

  async respondTaskRequest(requestId: string, status: 'ACCEPTED' | 'DECLINED'): Promise<void> {
    await api.callBackend('respondTaskRequest', { requestId, status });
  }
};
