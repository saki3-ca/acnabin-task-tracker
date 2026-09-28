import { api } from './api';
import { ManpowerRecord, StaffLookupResult } from '../types';

export const manpowerService = {
  async getManpower(options?: { includeAll?: boolean }): Promise<ManpowerRecord[]> {
    return api.callBackend<ManpowerRecord[]>('getManpower', { includeAll: options?.includeAll || false });
  },

  async getClientManpowerRemarks(): Promise<Record<string, string>> {
    return api.callBackend<Record<string, string>>('getClientManpowerRemarks', {});
  },

  async saveClientManpowerRemark(clientId: string, remarks: string, updatedBy?: string): Promise<{ success: boolean }> {
    return api.callBackend<{ success: boolean }>('saveClientManpowerRemark', { clientId, remarks, updatedBy });
  },

  async lookupStaff(empId: string): Promise<StaffLookupResult | null> {
    if (!empId || !empId.trim()) return null;
    return api.callBackend<StaffLookupResult | null>('lookupStaff', { empId: empId.trim() });
  },

  async updateManpowerRecord(record: {
    empId: string;
    salary: number;
    conveyance: number;
    total: number;
    designation: string;
    academicYear: string;
    clientName?: string;
    remarks?: string;
  }): Promise<{ success: boolean }> {
    return api.callBackend<{ success: boolean }>('updateManpowerRecord', record);
  }
};
