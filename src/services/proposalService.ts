import { Proposal, ProposalAttachment, ProposalImportResult, ProposalImportRow, ProposalPerson } from '../types';
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
  },

  /** Link of the Google Apps Script that stores files in Drive ('' = not set up yet) */
  async getDriveUrl(): Promise<string> {
    return api.callBackend('proposalSettingsGet', {});
  },

  /** Admin only */
  async setDriveUrl(driveUrl: string): Promise<void> {
    await api.callBackend('proposalSettingsSet', { driveUrl });
  },

  async listAttachments(): Promise<ProposalAttachment[]> {
    return api.callBackend('proposalAttachmentList', {});
  },

  async addAttachment(a: { proposalId: string; fileName: string; mime: string; size: number; driveFileId: string; clientFolder: string }): Promise<void> {
    await api.callBackend('proposalAttachmentAdd', a);
  },

  /** Admin only: removes the record (the file is removed from Drive first, see driveFiles.deleteFromDrive) */
  async removeAttachment(id: string): Promise<void> {
    await api.callBackend('proposalAttachmentDelete', { id });
  },

  /** People who have access to the tracker (the "Assigned to" choices) */
  async people(): Promise<ProposalPerson[]> {
    return api.callBackend('proposalPeople', {});
  },

  /** Emails the people assigned to the proposal (only the ones not emailed before) */
  async emailAssigned(id: string): Promise<void> {
    try {
      await api.callBackend('proposalEmailAssigned', { id });
    } catch {
      /* the proposal is saved; a missing email must not block anything */
    }
  }
};
