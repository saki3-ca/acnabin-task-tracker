import { api } from './api';

export const manpowerAccessService = {
  /** Does the logged-in person have the Manpower tab through an Admin grant? */
  async hasAccess(): Promise<boolean> {
    return api.callBackend('manpowerHasAccess', {});
  },

  /** Admin only: ids of the people the Admin let in */
  async get(): Promise<string[]> {
    return api.callBackend('manpowerAccessGet', {});
  },

  async set(userIds: string[]): Promise<void> {
    await api.callBackend('manpowerAccessSet', { userIds });
  }
};
