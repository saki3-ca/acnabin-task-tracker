import { User } from '../types';
import { api } from './api';

export const authService = {
  async login(empId: string, password?: string): Promise<{ user: User; token: string }> {
    return api.callBackend('login', { empId, password });
  },

  async register(payload: {
    name: string;
    empId: string;
    email: string;
    clientId?: string;
    clientName?: string;
    password?: string;
  }): Promise<{ user: User; token: string }> {
    return api.callBackend('register', payload);
  },

  async getCurrentUser(): Promise<User | null> {
    return api.callBackend('getCurrentUser');
  },

  async logout(): Promise<void> {
    await api.callBackend('logout');
  },

  async switchUserForDemo(userId: string): Promise<User> {
    return api.callBackend('switchUserForDemo', { userId });
  }
};
