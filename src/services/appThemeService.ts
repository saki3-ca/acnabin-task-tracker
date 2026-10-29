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
  },

  /**
   * Persists personal user theme preference to the database for tracking & sync.
   */
  async setUserTheme(theme: AppTheme): Promise<void> {
    try {
      await api.callBackend('appUserThemeSet', { theme });
    } catch (e) {
      console.warn('Could not sync user theme to database:', e);
    }
  }
};
