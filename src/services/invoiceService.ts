import { Invoice, InvoiceAttachment, InvoiceImportResult, InvoiceImportRow } from '../types';
import { api } from './api';

export const invoiceService = {
  async hasAccess(): Promise<boolean> {
    return api.callBackend('invoiceHasAccess', {});
  },

  async list(): Promise<Invoice[]> {
    return api.callBackend('invoiceList', {});
  },

  /** Adds (no id) or edits (with id). Throws when the invoice number already exists.
   *  Throws an error with code 'SUBMISSION_DUP' when the submission number is used by another invoice (retry with force). */
  async save(fields: Partial<Invoice>, force = false): Promise<void> {
    await api.callBackend('invoiceSave', { fields, force });
  },

  /** Admin only: copies old invoices from a CSV. Invoice numbers that already exist are skipped. dryRun only reports. */
  async importRows(rows: InvoiceImportRow[], dryRun: boolean): Promise<InvoiceImportResult> {
    return api.callBackend('invoiceImport', { rows, dryRun });
  },

  /** Admin only */
  async remove(id: string): Promise<void> {
    await api.callBackend('invoiceDelete', { id });
  },

  /** Admin only: ids of the people who have the tab */
  async getAccess(): Promise<string[]> {
    return api.callBackend('invoiceAccessGet', {});
  },

  async setAccess(userIds: string[]): Promise<void> {
    await api.callBackend('invoiceAccessSet', { userIds });
  },

  /** Link of the Google Apps Script that stores the challan files in Drive ('' = not set up yet) */
  async getDriveUrl(): Promise<string> {
    return api.callBackend('invoiceSettingsGet', {});
  },

  /** Admin only */
  async setDriveUrl(driveUrl: string): Promise<void> {
    await api.callBackend('invoiceSettingsSet', { driveUrl });
  },

  async listAttachments(): Promise<InvoiceAttachment[]> {
    return api.callBackend('invoiceAttachmentList', {});
  },

  async addAttachment(a: { invoiceId: string; kind: 'VDS' | 'TDS'; fileName: string; mime: string; size: number; driveFileId: string }): Promise<void> {
    await api.callBackend('invoiceAttachmentAdd', a);
  },

  /** Admin only: removes the record (the file is removed from Drive first) */
  async removeAttachment(id: string): Promise<void> {
    await api.callBackend('invoiceAttachmentDelete', { id });
  }
};
