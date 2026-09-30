import { AppNotification } from '../types';
import { api } from './api';

export const notificationService = {
  async getNotifications(userId: string): Promise<AppNotification[]> {
    return api.callBackend('getNotifications', { userId });
  },

  async markAsRead(notificationId: string): Promise<void> {
    await api.callBackend('markNotificationRead', { notificationId });
  },

  async sendInfoRequest(): Promise<{ count: number }> {
    return api.callBackend('sendInfoRequest', {});
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

  async markAllAsRead(userId: string): Promise<void> {
    await api.callBackend('markAllNotificationsRead', { userId });
  }
};
