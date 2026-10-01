import { AppNotification, MyInfo, UserQuery } from '../types';
import { api } from './api';

export const notificationService = {
  async getNotifications(userId: string): Promise<AppNotification[]> {
    return api.callBackend('getNotifications', { userId });
  },

  async markAsRead(notificationId: string): Promise<void> {
    await api.callBackend('markNotificationRead', { notificationId });
  },

  async sendInfoRequest(userId?: string, group?: 'STD' | 'EMP'): Promise<{ count: number }> {
    return api.callBackend('sendInfoRequest', { userId, group });
  },

  async sendAnnouncement(message: string, userId?: string, group?: 'STD' | 'EMP'): Promise<{ count: number }> {
    return api.callBackend('sendAnnouncement', { message, userId, group });
  },

  async getMyInfo(): Promise<MyInfo | null> {
    return api.callBackend('getMyInfo', {});
  },

  async saveMyInfo(info: {
    academicYear?: string;
    salary?: number | '';
    dailyConveyance?: number | '';
    bloodGroup?: string;
    emergencyName?: string;
    emergencyPhone?: string;
  }): Promise<void> {
    await api.callBackend('saveMyInfo', info);
  },

  async submitProfileInfo(info: {
    academicYear: string;
    salary: number;
    dailyConveyance: number;
    bloodGroup: string;
    emergencyName: string;
    emergencyPhone: string;
  }): Promise<void> {
    await api.callBackend('submitProfileInfo', info);
  },

  async submitQuery(message: string): Promise<void> {
    await api.callBackend('submitQuery', { message });
  },

  async listQueries(): Promise<UserQuery[]> {
    return api.callBackend('listQueries', {});
  },

  async resolveQuery(queryId: number, note: string): Promise<void> {
    await api.callBackend('resolveQuery', { queryId, note });
  },

  async markAllAsRead(userId: string): Promise<void> {
    await api.callBackend('markAllNotificationsRead', { userId });
  }
};
