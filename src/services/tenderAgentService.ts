import { api } from './api';

export const tenderAgentService = {
  async hasAccess(): Promise<boolean> {
    return api.callBackend('tenderAgentHasAccess', {});
  },

  /** Admin only: short-lived token the Tender Agent dashboard uses to edit sources (null if not an Admin) */
  async bridgeToken(): Promise<string | null> {
    return api.callBackend('tenderAgentBridgeToken', {});
  },

  /** Admin only: ids of the people who have the tab */
  async getAccess(): Promise<string[]> {
    return api.callBackend('tenderAgentAccessGet', {});
  },

  async setAccess(userIds: string[]): Promise<void> {
    await api.callBackend('tenderAgentAccessSet', { userIds });
  }
};
