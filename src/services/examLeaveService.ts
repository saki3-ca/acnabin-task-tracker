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
    const ExcelJS = (await import('exceljs')).default;
    const records = allRecords.filter(countsAsLeave);
    const staffTotal = Math.max(totalStaff || 0, records.length);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ACNABIN Task Tracker';
    workbook.created = new Date();

    // No frozen rows: the routine tables above the matrix would fill the screen. Freeze SL + Name only.
    const sheet = workbook.addWorksheet('CL + PL & AL Level Leave Info.', {
      views: [{ state: 'frozen', xSplit: 3, ySplit: 0 }]
    });

    const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });
    const thin = { style: 'thin' as const, color: { argb: 'FFCBD5E1' } };
    const box = { top: thin, left: thin, bottom: thin, right: thin };
    const toDate = (iso: string): Date | null => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(Date.UTC(y, m - 1, d));
    };

    // Column widths: A spacer, B SL, C Name, D Client, E Subjects, F Level, G-I leave info, then one narrow column per day
    const FIRST_DAY_COL = 10;
    sheet.getColumn(1).width = 2;
    [5, 30, 24, 34, 9, 16, 14, 18].forEach((w, i) => { sheet.getColumn(i + 2).width = w; });
    dates.forEach((_, i) => { sheet.getColumn(FIRST_DAY_COL + i).width = 5; });
    sheet.getColumn(FIRST_DAY_COL + dates.length).width = 11;

    // --- Rows 1-14: the ICAB routine (PL | AL | CL), the same blocks as the firm's leave sheet
    const shortCode = (item: IcabExamScheduleItem): string => {
      if (item.isOffDay) return 'Off Day';
      if (item.level === 'CL') return item.subject;
      if (/^IT Governance/.test(item.subject)) return 'IT';
      const hit = [...ICAB_PAPERS_CATALOG.PL, ...ICAB_PAPERS_CATALOG.AL].find(p => p.date === item.date);
      return hit ? hit.code : item.subject;
    };
    const blocks: { title: string; level: 'PL' | 'AL' | 'CL'; col: number; span: number; color: string }[] = [
      { title: "PL November'26", level: 'PL', col: 2, span: 3, color: 'FF8B1420' },
      { title: "AL November'26", level: 'AL', col: 7, span: 2, color: 'FF1B2A6B' },
      { title: "CL November'26", level: 'CL', col: 11, span: 2, color: 'FF1D8C8C' }
    ];
    blocks.forEach(b => {
      const dateCol = b.col + b.span;
      sheet.mergeCells(1, b.col, 1, dateCol);
      sheet.getCell(1, b.col).value = 'Exam Schedule as per ICAB Routine';
      sheet.getCell(1, b.col).font = { italic: true, size: 9 };
      sheet.getCell(1, b.col).alignment = { horizontal: 'center' };
      sheet.mergeCells(2, b.col, 2, dateCol);
      const t = sheet.getCell(2, b.col);
      t.value = b.title;
      t.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      t.fill = fill(b.color);
      t.alignment = { horizontal: 'center' };
      sheet.mergeCells(3, b.col, 3, dateCol - 1);
      sheet.getCell(3, b.col).value = 'Subject';
      sheet.getCell(3, dateCol).value = 'Date';
      [b.col, dateCol].forEach(c => {
        sheet.getCell(3, c).font = { bold: true };
        sheet.getCell(3, c).fill = fill('FFF1F5F9');
        sheet.getCell(3, c).alignment = { horizontal: 'center' };
      });
      OFFICIAL_ICAB_SCHEDULE.filter(i => i.level === b.level).forEach((item, idx) => {
        const r = 4 + idx;
        sheet.mergeCells(r, b.col, r, dateCol - 1);
        const sc = sheet.getCell(r, b.col);
        sc.value = shortCode(item);
        const dc = sheet.getCell(r, dateCol);
        dc.value = toDate(item.date);
        dc.numFmt = 'dd-mmm-yy';
        dc.alignment = { horizontal: 'center' };
        if (item.isOffDay) {
          sc.font = { color: { argb: 'FFFFFFFF' }, bold: true };
          sc.fill = fill('FFFF0000');
          dc.fill = fill('FFFF0000');
          dc.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        }
      });
    });

    // Legend
    sheet.getCell('P2').value = 'OFF Day';
    sheet.getCell('P2').fill = fill('FFFF0000');
    sheet.getCell('P2').font = { color: { argb: 'FFFFFFFF' }, bold: true };
    sheet.getCell('P3').value = 'Study Leave';
    sheet.getCell('P3').fill = fill('FFFFFF00');
    sheet.getCell('P3').font = { bold: true };
    sheet.getCell('P4').value = 'Working day';
    sheet.getCell('P4').fill = fill('FFE2E8F0');

    // --- Row 18: available manpower, row 19: headers
    const HEADER_ROW = 19;
    sheet.getCell(18, 9).value = 'Available Manpower';
    sheet.getCell(18, 9).font = { bold: true };
    const headers = ['SL', 'Name', 'Client', 'Subjects', 'Level', 'Total Leave Days', 'Leave Start Day', 'Appear in Last Exam Date'];
    headers.forEach((h, idx) => {
      const cell = sheet.getRow(HEADER_ROW).getCell(idx + 2);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = fill('FF334155');
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = box;
    });
    sheet.getRow(HEADER_ROW).height = 42;

    dates.forEach((d, idx) => {
      const cell = sheet.getRow(HEADER_ROW).getCell(FIRST_DAY_COL + idx);
      cell.value = toDate(d);
      cell.numFmt = 'dd-mmm';
      cell.font = { bold: true, size: 9, color: { argb: isCentralHoliday(d) ? 'FFFFFFFF' : 'FF0F172A' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', textRotation: 90 };
      cell.fill = fill(isCentralHoliday(d) ? 'FFDC2626' : 'FFF1F5F9');
      cell.border = box;
    });
    const totalCol = FIRST_DAY_COL + dates.length;
    const totalHead = sheet.getRow(HEADER_ROW).getCell(totalCol);
    totalHead.value = 'Total Days';
    totalHead.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    totalHead.fill = fill('FF334155');
    totalHead.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    totalHead.border = box;

    // --- Data rows (from row 20), numbered 1..n so deleted people leave no gaps
    records.forEach((rec, rIdx) => {
      const row = sheet.getRow(HEADER_ROW + 1 + rIdx);
      const startDate = toDate(rec.leaveStartDay);
      const lastExam = toDate(rec.appearInLastExamDate);
      const values: (string | number | Date | null)[] = [
        rIdx + 1, rec.name, rec.category, rec.subjects, rec.level, rec.totalLeaveDays,
        startDate || (rec.leaveStartDay === '—' ? '' : rec.leaveStartDay),
        lastExam || (rec.appearInLastExamDate === '—' ? '' : rec.appearInLastExamDate)
      ];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 2);
        cell.value = v;
        cell.border = box;
        cell.alignment = { vertical: 'middle', horizontal: i === 1 || i === 2 || i === 3 ? 'left' : 'center', wrapText: true };
        if (v instanceof Date) cell.numFmt = 'dd-mmm-yy';
      });
      // keep tall subject lists readable
      const lines = String(rec.subjects || '').split('\n').length;
      row.height = Math.max(20, lines * 15);

      dates.forEach((d, dIdx) => {
        const cell = row.getCell(FIRST_DAY_COL + dIdx);
        cell.border = box;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (rec.leaveDates.includes(d)) {
          cell.value = 1;
          cell.fill = fill('FFFFFF00');
          cell.font = { bold: true };
        } else if (isCentralHoliday(d)) {
          cell.fill = fill('FFFFC7CE');
        }
      });
      const total = row.getCell(totalCol);
      total.value = rec.leaveDates.length;
      total.font = { bold: true };
      total.alignment = { horizontal: 'center', vertical: 'middle' };
      total.border = box;
    });

    // --- Summary row under the table + available manpower in row 18
    const summaryRow = sheet.getRow(HEADER_ROW + 1 + records.length);
    summaryRow.getCell(9).value = 'Total on Leave:';
    summaryRow.getCell(9).font = { bold: true };
    summaryRow.getCell(9).alignment = { horizontal: 'right' };

    dates.forEach((d, dIdx) => {
      const col = FIRST_DAY_COL + dIdx;
      const count = records.filter(r => r.leaveDates.includes(d)).length;
      const sumCell = summaryRow.getCell(col);
      sumCell.value = count;
      sumCell.font = { bold: true };
      sumCell.alignment = { horizontal: 'center' };
      sumCell.border = box;

      const availCell = sheet.getRow(18).getCell(col);
      availCell.value = staffTotal - count;
      availCell.font = { bold: true };
      availCell.alignment = { horizontal: 'center' };
      if (staffTotal - count <= 7) availCell.fill = fill('FFFCA5A5');
    });

    // Landscape, fit all columns on one page width
    sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    // Download buffer in browser
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ACNABIN_Exam_Leave_Information_Nov_2026.xlsx';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export const examLeaveService = new ExamLeaveService();
