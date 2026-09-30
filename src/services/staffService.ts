import { MyStaff, StaffDates, StaffImportResult } from '../types';
import { StaffRow } from '../lib/staffSheet';
import { api } from './api';

export const staffService = {
  async getMyStaff(): Promise<MyStaff | null> {
    return api.callBackend('getMyStaff', {});
  },

  /** Blank = leave as it is. Keys are the database column names (department, principal_name, ...). */
  async saveMyStaff(fields: Record<string, string>): Promise<void> {
    await api.callBackend('saveMyStaff', { fields });
  },

  async getStaffDates(): Promise<StaffDates[]> {
    return api.callBackend('getStaffDates', {});
  },

  async importStaff(rows: StaffRow[], mode: 'FILL' | 'OVERWRITE', dryRun: boolean): Promise<StaffImportResult> {
    return api.callBackend('importStaff', { rows, mode, dryRun });
  }
};
