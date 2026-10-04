import { api } from './api';
import { ManpowerRecord, ScopedManpower, StaffLookupResult } from '../types';

export const manpowerService = {
  async getManpower(options?: { includeAll?: boolean }): Promise<ManpowerRecord[]> {
    return api.callBackend<ManpowerRecord[]>('getManpower', { includeAll: options?.includeAll || false });
  },

  /** Below Assistant Director: only the people on their own clients, no money. null = use the full directory instead. */
  async getScoped(): Promise<ScopedManpower | null> {
    return api.callBackend<ScopedManpower | null>('getManpowerScoped', {});
  },

  async getSalaries(): Promise<{ empId: string; salary: number; conveyance: number }[]> {
    return api.callBackend('getManpowerSalaries', {});
  },

  async setSalary(empId: string, salary: number, conveyance: number): Promise<void> {
    await api.callBackend('setManpowerSalary', { empId, salary, conveyance });
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
