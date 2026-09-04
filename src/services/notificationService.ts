import { AppNotification } from '../types';
import { api } from './api';

export const notificationService = {
  async getNotifications(userId: string): Promise<AppNotification[]> {
    return api.callBackend('getNotifications', { userId });
  },

  async markAsRead(notificationId: string): Promise<void> {
    await api.callBackend('markNotificationRead', { notificationId });
  },

  async markAllAsRead(userId: string): Promise<void> {
    await api.callBackend('markAllNotificationsRead', { userId });
  }
};
