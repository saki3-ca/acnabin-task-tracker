import { ManagerAccessItem, ManagerStudentItem, User } from '../types';
import { api } from './api';

export const adminService = {
  async getAllUsers(): Promise<User[]> {
    return api.callBackend('getAllUsers');
  },

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    return api.callBackend('updateUser', { userId, updates });
  },

  async getManagerClients(managerUserId: string): Promise<ManagerAccessItem[]> {
    return api.callBackend('getManagerClients', { managerUserId });
  },

  async saveManagerClients(managerUserId: string, clientIds: string[]): Promise<void> {
    await api.callBackend('saveManagerClients', { managerUserId, clientIds });
  },

  async getManagerStudents(managerUserId: string): Promise<ManagerStudentItem[]> {
    return api.callBackend('getManagerStudents', { managerUserId });
  },

  async saveManagerStudents(managerUserId: string, studentIds: string[]): Promise<void> {
    await api.callBackend('saveManagerStudents', { managerUserId, studentIds });
  },

  async getManagerClientIds(managerUserId: string): Promise<string[]> {
    return api.callBackend('getManagerClientIds', { managerUserId });
  }
};
