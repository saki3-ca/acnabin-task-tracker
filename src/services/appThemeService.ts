import { api } from './api';

export type AppTheme = 'classic' | 'glass';

export const appThemeService = {
  /**
   * Fetches the database app theme. Allowed without login.
   * Returns 'classic' or 'glass' (defaults to 'classic' on error/offline).
   */
  async getTheme(): Promise<AppTheme> {
    try {
      const theme = await api.callBackend('appThemeGet', {});
      return theme === 'glass' ? 'glass' : 'classic';
    } catch {
      return 'classic';
    }
  },

  /**
   * Admin only. Persists the app theme to the database.
   */
  async setTheme(theme: AppTheme): Promise<void> {
    await api.callBackend('appThemeSet', { theme });
  }
};
