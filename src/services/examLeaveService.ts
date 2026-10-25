import { IcabExamScheduleItem, StaffExamLeaveRecord } from '../types';
import { api } from './api';

export const EXAM_TIMELINE_DATES: string[] = [
  '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30',
  '2026-10-31', '2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04',
  '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09',
  '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14',
  '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19',
  '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24',
  '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29',
  '2026-11-30'
];

export const ICAB_OFF_DAYS = new Set([
  // Fridays (Central Holiday - Office Closed)
  '2026-10-30',
  '2026-11-06',
  '2026-11-13',
  '2026-11-20',
  '2026-11-27',
  // Saturdays (Central Holiday - Office Closed)
  '2026-10-31',
  '2026-11-07',
  '2026-11-14',
  '2026-11-21',
  '2026-11-28'
]);

export const isCentralHoliday = (dateStr: string): boolean => {
  if (ICAB_OFF_DAYS.has(dateStr)) return true;
  const parts = dateStr.split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = d.getDay();
  return day === 5 || day === 6; // Friday=5, Saturday=6
};

export const ICAB_PAPERS_CATALOG = {
  CL: [
    { code: 'i', name: 'Assurance', date: '2026-11-23' },
    { code: 'ii', name: 'Accounting', date: '2026-11-24' },
    { code: 'iii', name: 'Business, Technology and Finance', date: '2026-11-25' },
    { code: 'iv', name: 'Management Information', date: '2026-11-26' },
    { code: 'v', name: 'Principles of Taxation', date: '2026-11-28' },
    { code: 'vi', name: 'Business Law', date: '2026-11-29' },
    { code: 'vii', name: 'Information Technology', date: '2026-11-30' }
  ],
  PL: [
    { code: 'FAR', name: 'Financial Accounting & Reporting', date: '2026-11-08' },
    { code: 'Law', name: 'Corporate Laws & Practices', date: '2026-11-09' },
    { code: 'FM', name: 'Financial Management', date: '2026-11-11' },
    { code: 'BST', name: 'Business Strategy & Technology', date: '2026-11-12' },
    { code: 'Tax', name: 'Business Planning: Taxation & Compliance', date: '2026-11-14' },
    { code: 'A&A', name: 'Audit & Assurance', date: '2026-11-16' },
    { code: 'IT', name: 'IT Governance', date: '2026-11-19' }
  ],
  AL: [
    { code: 'CR', name: 'Corporate Reporting', date: '2026-11-10' },
    { code: 'SBM', name: 'Strategic Business Management & Leadership', date: '2026-11-15' },
    { code: 'CS', name: 'Case Study', date: '2026-11-17' }
  ]
};

export const OFFICIAL_ICAB_SCHEDULE: IcabExamScheduleItem[] = [
  // Professional & Advanced Level (Nov 8 - Nov 21)
  {
    id: 'icab-1',
    level: 'PL',
    subject: 'Financial Accounting & Reporting',
    date: '2026-11-08',
    dayName: 'Sunday',
    timeSlot: '02:00 pm - 5:30 pm'
  },
  {
    id: 'icab-2',
    level: 'PL',
    subject: 'Corporate Laws & Practices',
    date: '2026-11-09',
    dayName: 'Monday',
    timeSlot: '02:00 pm - 5:30 pm'
  },
  {
    id: 'icab-3',
    level: 'AL',
    subject: 'Corporate Reporting',
    date: '2026-11-10',
    dayName: 'Tuesday',
    timeSlot: '02:00 pm - 5:30 pm'
  },
  {
    id: 'icab-4',
    level: 'PL',
    subject: 'Financial Management',
    date: '2026-11-11',
    dayName: 'Wednesday',
    timeSlot: '02:00 pm - 5:30 pm'
  },
  {
    id: 'icab-5',
    level: 'PL',
    subject: 'Business Strategy & Technology',
    date: '2026-11-12',
    dayName: 'Thursday',
    timeSlot: '02:00 pm - 5:30 pm'
  },
  {
    id: 'icab-6',
    level: 'PL',
    subject: 'Off Day',
    date: '2026-11-13',
    dayName: 'Friday',
    isOffDay: true
  },
  {
    id: 'icab-7',
    level: 'PL',
    subject: 'Business Planning: Taxation & Compliance',
    date: '2026-11-14',
    dayName: 'Saturday',
    timeSlot: '02:00 pm - 5:30 pm'
  },
  {
    id: 'icab-8',
    level: 'AL',
    subject: 'Strategic Business Management & Leadership',
    date: '2026-11-15',
    dayName: 'Sunday',
    timeSlot: '02:00 pm - 5:30 pm'
  },
  {
    id: 'icab-9',
    level: 'PL',
    subject: 'Audit & Assurance',
    date: '2026-11-16',
    dayName: 'Monday',
    timeSlot: '02:00 pm - 5:30 pm'
  },
  {
    id: 'icab-10',
    level: 'AL',
    subject: 'Case Study',
    date: '2026-11-17',
    dayName: 'Tuesday',
    timeSlot: '02:00 pm - 6:30 pm'
  },
  {
    id: 'icab-11',
    level: 'PL',
    subject: 'Off Day',
    date: '2026-11-18',
    dayName: 'Wednesday',
    isOffDay: true
  },
  {
    id: 'icab-12',
    level: 'PL',
    subject: 'IT Governance',
    date: '2026-11-19',
    dayName: 'Thursday',
    timeSlot: '10:00 am - 2:00 pm / 3:00 pm - 7:00 pm'
  },
  {
    id: 'icab-13',
    level: 'PL',
    subject: 'Off Day',
    date: '2026-11-20',
    dayName: 'Friday',
    isOffDay: true
  },
  {
    id: 'icab-14',
    level: 'PL',
    subject: 'IT Governance (Slot 2)',
    date: '2026-11-21',
    dayName: 'Saturday',
    timeSlot: '10:00 am - 2:00 pm / 3:00 pm - 7:00 pm'
  },

  // Certificate Level (Nov 23 - Nov 30)
  {
    id: 'icab-cl-1',
    level: 'CL',
    paperCode: 'i',
    subject: 'Assurance',
    date: '2026-11-23',
    dayName: 'Monday',
    timeSlot: 'Time slot per roll allocation'
  },
  {
    id: 'icab-cl-2',
    level: 'CL',
    paperCode: 'ii',
    subject: 'Accounting',
    date: '2026-11-24',
    dayName: 'Tuesday',
    timeSlot: 'Time slot per roll allocation'
  },
  {
    id: 'icab-cl-3',
    level: 'CL',
    paperCode: 'iii',
    subject: 'Business, Technology and Finance',
    date: '2026-11-25',
    dayName: 'Wednesday',
    timeSlot: 'Time slot per roll allocation'
  },
  {
    id: 'icab-cl-4',
    level: 'CL',
    paperCode: 'iv',
    subject: 'Management Information',
    date: '2026-11-26',
    dayName: 'Thursday',
    timeSlot: 'Time slot per roll allocation'
  },
  {
    id: 'icab-cl-5',
    level: 'CL',
    subject: 'Off Day',
    date: '2026-11-27',
    dayName: 'Friday',
    isOffDay: true
  },
  {
    id: 'icab-cl-6',
    level: 'CL',
    paperCode: 'v',
    subject: 'Principles of Taxation',
    date: '2026-11-28',
    dayName: 'Saturday',
    timeSlot: 'Time slot per roll allocation'
  },
  {
    id: 'icab-cl-7',
    level: 'CL',
    paperCode: 'vi',
    subject: 'Business Law',
    date: '2026-11-29',
    dayName: 'Sunday',
    timeSlot: 'Time slot per roll allocation'
  },
  {
    id: 'icab-cl-8',
    level: 'CL',
    paperCode: 'vii',
    subject: 'Information Technology',
    date: '2026-11-30',
    dayName: 'Monday',
    timeSlot: 'Time slot per roll allocation'
  }
];

export const INITIAL_STAFF_RECORDS: StaffExamLeaveRecord[] = [];

// v3: drops the test records saved under v1/v2.
const STORAGE_KEY = 'acnabin_exam_leaves_data_v3';
const OLD_STORAGE_KEYS = ['acnabin_exam_leaves_data_v1', 'acnabin_exam_leaves_data_v2'];

/** Same person if the names match exactly once case and extra spaces are ignored. */
export const sameName = (a?: string, b?: string): boolean => {
  const norm = (v?: string) => (v || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const x = norm(a);
  return x !== '' && x === norm(b);
};

/** Single-letter weekday for a YYYY-MM-DD date, read in local time (new Date('YYYY-MM-DD') is UTC). */
export const weekdayLetter = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'narrow' });
};

/** A rejected application does not take the person out of the office. */
export const countsAsLeave = (r: StaffExamLeaveRecord): boolean => r.status !== 'Rejected';

class ExamLeaveService {
  private getStorage(): StaffExamLeaveRecord[] {
    try {
      OLD_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as StaffExamLeaveRecord[];
      }
    } catch (e) {
      console.warn('Failed to parse stored exam leaves, falling back to defaults:', e);
    }
    return INITIAL_STAFF_RECORDS;
  }

  /** Is the Exam Leave tab switched on for everyone? (Admin turns it on for exam time.) */
  async isEnabled(): Promise<boolean> {
    return api.callBackend<boolean>('examLeaveEnabledGet', {});
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await api.callBackend('examLeaveEnabledSet', { enabled });
  }

  async clearAllLeaves(): Promise<void> {
    this.setStorage([]);
  }

  private setStorage(records: StaffExamLeaveRecord[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to store exam leaves in localStorage:', e);
    }
  }

  async getLeaves(): Promise<StaffExamLeaveRecord[]> {
    return this.getStorage();
  }

  async saveLeave(record: StaffExamLeaveRecord): Promise<StaffExamLeaveRecord> {
    const list = this.getStorage();
    const index = list.findIndex(r => r.id === record.id);
    if (index >= 0) {
      list[index] = record;
    } else {
      list.push(record);
    }
    this.setStorage(list);
    return record;
  }

  async deleteLeave(id: string): Promise<boolean> {
    const list = this.getStorage();
    const filtered = list.filter(r => r.id !== id);
    this.setStorage(filtered);
    return true;
  }

  async resetToDefaults(): Promise<StaffExamLeaveRecord[]> {
    this.setStorage(INITIAL_STAFF_RECORDS);
    return INITIAL_STAFF_RECORDS;
  }

  async approveLeave(id: string): Promise<StaffExamLeaveRecord | null> {
    const list = this.getStorage();
    const item = list.find(r => r.id === id);
    if (!item) return null;
    item.status = 'Approved';
    this.setStorage(list);
    return item;
  }

  async rejectLeave(id: string): Promise<StaffExamLeaveRecord | null> {
    const list = this.getStorage();
    const item = list.find(r => r.id === id);
    if (!item) return null;
    item.status = 'Rejected';
    this.setStorage(list);
    return item;
  }

  getIcabSchedule(): IcabExamScheduleItem[] {
    return OFFICIAL_ICAB_SCHEDULE;
  }

  getDates(): string[] {
    return EXAM_TIMELINE_DATES;
  }

  isStaffOnLeave(staffName: string, dateStr: string): boolean {
    if (!staffName || !dateStr) return false;
    const match = this.getStorage().find(r => countsAsLeave(r) && sameName(r.name, staffName));
    if (!match) return false;
    return match.leaveDates.includes(dateStr);
  }

  getStaffLeaveDetail(staffName: string): StaffExamLeaveRecord | undefined {
    if (!staffName) return undefined;
    return this.getStorage().find(r => countsAsLeave(r) && sameName(r.name, staffName));
  }

  async exportToExcel(allRecords: StaffExamLeaveRecord[], dates: string[], totalStaff?: number): Promise<void> {
    const records = allRecords.filter(countsAsLeave);
    const staffTotal = Math.max(totalStaff || 0, records.length);
    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ACNABIN Task Tracker';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('CL + PL & AL Level Leave Info.', {
      views: [{ state: 'frozen', xSplit: 9, ySplit: 19 }]
    });

    // 1. Title Header Rows 1-3
    sheet.mergeCells('B2:E2');
    sheet.getCell('B2').value = 'PL November\'26 Routine';
    sheet.getCell('B2').font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('B2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF8B1420' } };
    sheet.getCell('B2').alignment = { horizontal: 'center' };

    sheet.mergeCells('G2:I2');
    sheet.getCell('G2').value = 'AL November\'26 Routine';
    sheet.getCell('G2').font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('G2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B2A6B' } };
    sheet.getCell('G2').alignment = { horizontal: 'center' };

    sheet.mergeCells('K2:M2');
    sheet.getCell('K2').value = 'CL November\'26 Routine';
    sheet.getCell('K2').font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('K2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D8C8C' } };
    sheet.getCell('K2').alignment = { horizontal: 'center' };

    // Legend at P2:R4
    sheet.getCell('P2').value = 'OFF Day';
    sheet.getCell('P2').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
    sheet.getCell('P2').font = { color: { argb: 'FFFFFFFF' }, bold: true };

    sheet.getCell('P3').value = 'Study Leave';
    sheet.getCell('P3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    sheet.getCell('P3').font = { bold: true };

    sheet.getCell('P4').value = 'Active Duty';
    sheet.getCell('P4').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };

    // Row 18: Available Manpower
    sheet.getCell('I18').value = 'Available Manpower';
    sheet.getCell('I18').font = { bold: true };

    // Row 19: Column Headers
    const headers = [
      '', 'SL', 'Name', 'Client', 'Subjects', 'Level',
      'Total Leave Days', 'Leave Start Day', 'Appear in Last Exam Date'
    ];
    headers.forEach((h, idx) => {
      if (idx > 0) {
        const cell = sheet.getRow(19).getCell(idx + 1);
        cell.value = h;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });

    dates.forEach((d, idx) => {
      const col = idx + 10;
      const cell = sheet.getRow(19).getCell(col);
      cell.value = d.slice(5); // MM-DD
      cell.font = { bold: true, size: 9 };
      cell.alignment = { horizontal: 'center' };
      if (ICAB_OFF_DAYS.has(d)) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      }
    });

    sheet.getRow(19).getCell(dates.length + 10).value = 'Total Days';
    sheet.getRow(19).getCell(dates.length + 10).font = { bold: true };

    // Fill Data Rows (starting row 20)
    records.forEach((rec, rIdx) => {
      const rNum = rIdx + 20;
      const row = sheet.getRow(rNum);
      row.getCell(2).value = rec.sl;
      row.getCell(3).value = rec.name;
      row.getCell(4).value = rec.category;
      row.getCell(5).value = rec.subjects;
      row.getCell(6).value = rec.level;
      row.getCell(7).value = rec.totalLeaveDays;
      row.getCell(8).value = rec.leaveStartDay;
      row.getCell(9).value = rec.appearInLastExamDate;

      dates.forEach((d, dIdx) => {
        const col = dIdx + 10;
        const cell = row.getCell(col);
        const isOnLeave = rec.leaveDates.includes(d);
        const isOffDay = ICAB_OFF_DAYS.has(d);

        if (isOnLeave) {
          cell.value = 1;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
          cell.alignment = { horizontal: 'center' };
        } else if (isOffDay) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });

      row.getCell(dates.length + 10).value = rec.leaveDates.length;
    });

    // Row 37: Total on leave per day
    const summaryRow = sheet.getRow(records.length + 20);
    summaryRow.getCell(9).value = 'Total on Leave:';
    summaryRow.getCell(9).font = { bold: true };

    dates.forEach((d, dIdx) => {
      const col = dIdx + 10;
      const count = records.filter(r => r.leaveDates.includes(d)).length;
      summaryRow.getCell(col).value = count;
      summaryRow.getCell(col).font = { bold: true };
      summaryRow.getCell(col).alignment = { horizontal: 'center' };

      // Also set Available Manpower in row 18
      const availCell = sheet.getRow(18).getCell(col);
      availCell.value = staffTotal - count;
      availCell.font = { bold: true };
      availCell.alignment = { horizontal: 'center' };
      if (staffTotal - count <= 7) {
        availCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCA5A5' } };
      }
    });

    // Download buffer in browser
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ACNABIN_Exam_Leave_Information_Nov_2026.xlsx`;
    anchor.click();
    URL.revokeObjectURL(url);
  }
}

export const examLeaveService = new ExamLeaveService();
