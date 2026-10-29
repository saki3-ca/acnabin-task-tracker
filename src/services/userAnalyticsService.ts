import { api } from './api';

export interface DailyLoginPoint {
  date: string;
  count: number;
}

export interface UserLoginStat {
  user_id: string;
  login_count: number;
  last_login_at: string | null;
}

export interface UserAnalyticsSummary {
  total_logins: number;
  weekly_logins: number;
  today_logins: number;
  active_users_7d: number;
  active_users_today: number;
  daily_logins: DailyLoginPoint[];
  user_stats: UserLoginStat[];
  theme_counts: Record<string, number>;
}

export const userAnalyticsService = {
  async getAnalytics(): Promise<UserAnalyticsSummary | null> {
    try {
      return await api.callBackend<UserAnalyticsSummary | null>('userAnalyticsGet');
    } catch (e) {
      console.warn('Could not fetch backend user analytics:', e);
      return null;
    }
  }
};
