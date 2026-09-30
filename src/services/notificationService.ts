import { AppNotification, ChatMessage } from '../types';
import { api } from './api';

export const notificationService = {
  async getNotifications(userId: string): Promise<AppNotification[]> {
    return api.callBackend('getNotifications', { userId });
  },

  async markAsRead(notificationId: string): Promise<void> {
    await api.callBackend('markNotificationRead', { notificationId });
  },

  async sendInfoRequest(userId?: string): Promise<{ count: number }> {
    return api.callBackend('sendInfoRequest', { userId });
  },

  async sendAnnouncement(message: string): Promise<{ count: number }> {
    return api.callBackend('sendAnnouncement', { message });
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

  async chatSendQuestion(userId: string, message: string): Promise<void> {
    await api.callBackend('chatSendQuestion', { userId, message });
  },

  async chatReply(questionId: number, message: string, userId?: string): Promise<void> {
    await api.callBackend('chatReply', { questionId, message, userId });
  },

  async chatGetThread(userId?: string): Promise<ChatMessage[]> {
    return api.callBackend('chatGetThread', { userId });
  },

  async markAllAsRead(userId: string): Promise<void> {
    await api.callBackend('markAllNotificationsRead', { userId });
  }
};
