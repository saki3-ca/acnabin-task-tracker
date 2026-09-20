import { ManagerAccessItem, ManagerStudentItem, User } from '../types';
import { api } from './api';

const managerClientIdsCache = new Map<string, string[]>();

function getStorageCacheKey(managerUserId: string): string {
  return `acnabin_manager_client_ids_${managerUserId}`;
}

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
    // Update local cache immediately
    managerClientIdsCache.set(managerUserId, clientIds);
    try {
      localStorage.setItem(getStorageCacheKey(managerUserId), JSON.stringify(clientIds));
    } catch {}

    await api.callBackend('saveManagerClients', { managerUserId, clientIds });
  },

  async getManagerStudents(managerUserId: string): Promise<ManagerStudentItem[]> {
    return api.callBackend('getManagerStudents', { managerUserId });
  },

  async saveManagerStudents(managerUserId: string, studentIds: string[]): Promise<void> {
    await api.callBackend('saveManagerStudents', { managerUserId, studentIds });
  },

  getCachedManagerClientIds(managerUserId: string): string[] | null {
    if (managerClientIdsCache.has(managerUserId)) {
      return managerClientIdsCache.get(managerUserId)!;
    }
    try {
      const stored = localStorage.getItem(getStorageCacheKey(managerUserId));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          managerClientIdsCache.set(managerUserId, parsed);
          return parsed;
        }
      }
    } catch {}
    return null;
  },

  async getManagerClientIds(managerUserId: string): Promise<string[]> {
    try {
      const ids: string[] = await api.callBackend('getManagerClientIds', { managerUserId });
      if (Array.isArray(ids)) {
        managerClientIdsCache.set(managerUserId, ids);
        try {
          localStorage.setItem(getStorageCacheKey(managerUserId), JSON.stringify(ids));
        } catch {}
      }
      return ids;
    } catch (err) {
      // Return cached fallback if network error
      const cached = this.getCachedManagerClientIds(managerUserId);
      if (cached) return cached;
      throw err;
    }
  },

  async prefetchManagerClientIds(managerUserId: string): Promise<string[]> {
    return this.getManagerClientIds(managerUserId);
  }
};

