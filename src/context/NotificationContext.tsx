import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { notificationService } from '../services/notificationService';
import { taskRequestService } from '../services/taskRequestService';
import { AppNotification, TaskRequest } from '../types';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  taskRequests: TaskRequest[];
  pendingRequestsCount: number;
  isLoading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  refreshRequests: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [taskRequests, setTaskRequests] = useState<TaskRequest[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshNotifications = useCallback(async () => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }
    try {
      const list = await notificationService.getNotifications(currentUser.id);
      setNotifications(list);
    } catch (e) {
      console.warn('Error loading notifications', e);
    }
  }, [currentUser]);

  const refreshRequests = useCallback(async () => {
    if (!currentUser) {
      setTaskRequests([]);
      return;
    }
    try {
      const list = await taskRequestService.getTaskRequests(currentUser.id);
      setTaskRequests(list);
    } catch (e) {
      console.warn('Error loading task requests', e);
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      setIsLoading(true);
      Promise.all([refreshNotifications(), refreshRequests()]).finally(() => {
        setIsLoading(false);
      });

      // Poll periodically every 30 seconds for background alerts
      const interval = setInterval(() => {
        refreshNotifications();
        refreshRequests();
      }, 30000);

      return () => clearInterval(interval);
    } else {
      setNotifications([]);
      setTaskRequests([]);
    }
  }, [currentUser, refreshNotifications, refreshRequests]);

  const markAsRead = async (id: string) => {
    try {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      await notificationService.markAsRead(id);
    } catch (e) {
      console.warn('Failed to mark read', e);
    }
  };

  const markAllAsRead = async () => {
    if (!currentUser) return;
    try {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      await notificationService.markAllAsRead(currentUser.id);
    } catch (e) {
      console.warn('Failed to mark all read', e);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Pending requests where currentUser is the superior
  const pendingRequestsCount = taskRequests.filter(
    r => r.superiorId === currentUser?.id && r.status === 'PENDING'
  ).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        taskRequests,
        pendingRequestsCount,
        isLoading,
        markAsRead,
        markAllAsRead,
        refreshNotifications,
        refreshRequests
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = (): NotificationContextType => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
