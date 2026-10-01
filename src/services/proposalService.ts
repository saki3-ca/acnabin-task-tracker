import { Proposal, ProposalImportResult, ProposalImportRow } from '../types';
import { api } from './api';

export const proposalService = {
  async hasAccess(): Promise<boolean> {
    return api.callBackend('proposalHasAccess', {});
  },

  async list(): Promise<Proposal[]> {
    return api.callBackend('proposalList', {});
  },

  /** Adds (no id) or edits (with id). Throws when the same name + client already exists. */
  async save(fields: Partial<Proposal>): Promise<void> {
    await api.callBackend('proposalSave', { fields });
  },

  /** Admin only */
  async remove(id: string): Promise<void> {
    await api.callBackend('proposalDelete', { id });
  },

  /** Admin only. Never creates duplicates: existing proposals are skipped. */
  async importRows(rows: ProposalImportRow[], dryRun: boolean): Promise<ProposalImportResult> {
    return api.callBackend('proposalImport', { rows, dryRun });
  },

  /** Admin only: ids of the users who have the tab */
  async getAccess(): Promise<string[]> {
    return api.callBackend('proposalAccessGet', {});
  },

  async setAccess(userIds: string[]): Promise<void> {
    await api.callBackend('proposalAccessSet', { userIds });
  }
};
