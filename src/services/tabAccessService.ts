import { MyTabAccess, TabAccessEntry, TabAccessKey, TabAccessMode } from '../types';
import { api } from './api';

export const tabAccessService = {
  /** What the logged-in person (or, for Admin "Switch User", the person being viewed) gets for each tab */
  async mine(): Promise<MyTabAccess | null> {
    return api.callBackend('tabAccessMine', {});
  },

  /** Admin only */
  async getAll(): Promise<Record<TabAccessKey, TabAccessEntry>> {
    return api.callBackend('tabAccessGet', {});
  },

  /** Admin only. mode null = back to the old rule; userIds / exceptIds undefined = keep that people list as it is. */
  async set(tab: TabAccessKey, mode: TabAccessMode | null, userIds?: string[], exceptIds?: string[]): Promise<void> {
    await api.callBackend('tabAccessSet', { tab, mode, userIds: userIds ?? null, exceptIds: exceptIds ?? null });
  }
};
