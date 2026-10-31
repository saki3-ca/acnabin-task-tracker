import { api } from './api';

export interface AnalyticsUser {
  userId: string;
  name: string;
  empId: string;
  designation: string;
  role: string;
  status: string;
  theme: string;
  totalLogins: number;
  logins: number;
  loginsWeek: number;
  activeDays: number;
  lastLogin: string | null;
  actions: number;
}

export interface UserAnalytics {
  trackingSince: string | null;
  totalLogins: number;
  logins: number;
  loginsToday: number;
  loginsWeek: number;
  activeUsersToday: number;
  activeUsers: number;
  activeUsersWeek: number;
  daily: { date: string; logins: number; users: number }[];
  byWeekday: { day: number; logins: number }[];
  byHour: { hour: number; logins: number }[];
  users: AnalyticsUser[];
  clients: { clientName: string; actions: number; users: number; tasks: number }[];
  userClients: { userId: string; clientName: string; actions: number }[];
}

export const userAnalyticsService = {
  /** Tell the database this person just opened the app with a saved session (counted at most once per 4 hours). */
  ping(): void {
    void api.callBackend('sessionPing').catch(() => {});
  },

  /** Admin only. days = how far back (0 = all time). */
  async get(days: number): Promise<UserAnalytics> {
    return api.callBackend<UserAnalytics>('userAnalyticsGet', { days });
  }
};
