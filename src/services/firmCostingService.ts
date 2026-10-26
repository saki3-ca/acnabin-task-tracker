import { FirmCostingRow } from '../types';
import { api } from './api';

export const firmCostingService = {
  async list(): Promise<FirmCostingRow[]> {
    return api.callBackend('firmCostingList', {});
  },

  /** Replaces every row of that month (YYYY-MM) with the given rows. */
  async saveMonth(month: string, rows: FirmCostingRow[]): Promise<void> {
    await api.callBackend('firmCostingSaveMonth', { month, rows });
  },

  /** '' when Admin has not chosen one yet */
  async getTheme(): Promise<string> {
    return api.callBackend('firmCostingThemeGet', {});
  },

  /** Admin only */
  async setTheme(theme: string): Promise<void> {
    await api.callBackend('firmCostingThemeSet', { theme });
  }
};
