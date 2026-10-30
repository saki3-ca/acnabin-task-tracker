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
    { code: 'AA', name: 'Assurance', date: '2026-11-23' },
    { code: 'ACC', name: 'Accounting', date: '2026-11-24' },
    { code: 'BTF', name: 'Business, Technology and Finance', date: '2026-11-25' },
    { code: 'MI', name: 'Management Information', date: '2026-11-26' },
    { code: 'Tax', name: 'Principles of Taxation', date: '2026-11-28' },
    { code: 'Law', name: 'Business Law', date: '2026-11-29' },
    { code: 'IT', name: 'Information Technology', date: '2026-11-30' }
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
    paperCode: 'AA',
    subject: 'Assurance',
    date: '2026-11-23',
    dayName: 'Monday',
    timeSlot: 'Time slot per roll allocation'
  },
  {
    id: 'icab-cl-2',
    level: 'CL',
    paperCode: 'ACC',
    subject: 'Accounting',
    date: '2026-11-24',
    dayName: 'Tuesday',
    timeSlot: 'Time slot per roll allocation'
  },
  {
    id: 'icab-cl-3',
    level: 'CL',
    paperCode: 'BTF',
    subject: 'Business, Technology and Finance',
    date: '2026-11-25',
    dayName: 'Wednesday',
    timeSlot: 'Time slot per roll allocation'
  },
  {
    id: 'icab-cl-4',
    level: 'CL',
    paperCode: 'MI',
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
    paperCode: 'Tax',
    subject: 'Principles of Taxation',
    date: '2026-11-28',
    dayName: 'Saturday',
    timeSlot: 'Time slot per roll allocation'
  },
  {
    id: 'icab-cl-7',
    level: 'CL',
    paperCode: 'Law',
    subject: 'Business Law',
    date: '2026-11-29',
    dayName: 'Sunday',
    timeSlot: 'Time slot per roll allocation'
  },
  {
    id: 'icab-cl-8',
    level: 'CL',
    paperCode: 'IT',
    subject: 'Information Technology',
    date: '2026-11-30',
    dayName: 'Monday',
    timeSlot: 'Time slot per roll allocation'
  }
];

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

/** One person can have several records (one per level: PL, CL, AL); a person counts once per day. */
export const countOnLeave = (records: StaffExamLeaveRecord[], dateStr: string): number => {
  const people = new Set<string>();
  records.forEach(r => {
    if (r.status !== 'Rejected' && r.leaveDates.includes(dateStr)) people.add(r.name.trim().replace(/\s+/g, ' ').toLowerCase());
  });
  return people.size;
};

/** Number of different people in a list of records. */
export const countPeople = (records: StaffExamLeaveRecord[]): number =>
  new Set(records.map(r => r.name.trim().replace(/\s+/g, ' ').toLowerCase())).size;

/** CL papers were saved as roman numerals (i-vii), then as AC / BF, before getting their current codes. */
const LEGACY_CL_CODES: Record<string, string> = { i: 'AA', ii: 'ACC', iii: 'BTF', iv: 'MI', v: 'Tax', vi: 'Law', vii: 'IT', ac: 'ACC', bf: 'BTF' };

type RecordPaper = Omit<NonNullable<StaffExamLeaveRecord['papers']>[number], 'level'> & { level: 'PL' | 'AL' | 'CL' };

/** Levels of a record in a fixed order: 'PL & AL' */
export const LEVEL_ORDER: ('PL' | 'AL' | 'CL')[] = ['PL', 'AL', 'CL'];
export const levelsOfRecord = (rec: StaffExamLeaveRecord): ('PL' | 'AL' | 'CL')[] =>
  LEVEL_ORDER.filter(l => new RegExp(`\\b${l}\\b`).test(rec.level || ''));

/** The papers of a leave record (with level and attempt). Older records only have text like
 *  "1. FM (1st Attempt - 5 days)", with the level taken from the record or from "PL" / "CL" heading lines. */
export const getRecordPapers = (rec: StaffExamLeaveRecord): RecordPaper[] => {
  const levels = levelsOfRecord(rec);
  if (levels.length === 0) return [];
  const fix = (level: 'PL' | 'AL' | 'CL', code: string) => (level === 'CL' ? LEGACY_CL_CODES[code.toLowerCase()] || code : code);
  if (rec.papers && rec.papers.length > 0) {
    return rec.papers.map(p => {
      const level = p.level || levels[0];
      const code = fix(level, p.code);
      const hit = ICAB_PAPERS_CATALOG[level].find(c => c.code === code);
      return { ...p, level, code, name: hit?.name || p.name };
    });
  }
  const parsed: RecordPaper[] = [];
  let level: 'PL' | 'AL' | 'CL' = levels[0];
  (rec.subjects || '').split('\n').forEach(line => {
    const head = /^\s*(PL|AL|CL)\s*$/i.exec(line);
    if (head) { level = head[1].toUpperCase() as 'PL' | 'AL' | 'CL'; return; }
    const m = /^\s*\d+\.\s*(.+?)\s*(?:\((.*)\))?\s*$/.exec(line);
    if (!m) return;
    const code = fix(level, m[1].trim());
    const paper = ICAB_PAPERS_CATALOG[level].find(c => c.code.toLowerCase() === code.toLowerCase());
    if (!paper || parsed.some(x => x.code === paper.code && x.level === level)) return;
    const note = m[2] || '';
    const attempt = /1st/i.test(note) ? '1st Attempt' : /2nd/i.test(note) ? '2nd Attempt' : '3rd Attempt & rest';
    parsed.push({ ...paper, level, attempt });
  });
  return parsed;
};

/** Short codes of the papers this person sits on the given day, e.g. ['FAR'] */
export const examCodesOn = (rec: StaffExamLeaveRecord, dateStr: string): string[] =>
  getRecordPapers(rec).filter(p => p.date === dateStr).map(p => p.code);

/** The papers (with level) this person sits on the given day */
export const examPapersOn = (rec: StaffExamLeaveRecord, dateStr: string): RecordPaper[] =>
  getRecordPapers(rec).filter(p => p.date === dateStr);

/** Short code of a routine row: 'FAR', 'FM', 'AA' ... ('' for an off day) */
export const routineCode = (item: IcabExamScheduleItem): string => {
  if (item.isOffDay) return '';
  if (item.paperCode) return item.paperCode;
  if (/^IT Governance/.test(item.subject)) return 'IT';
  const hit = [...ICAB_PAPERS_CATALOG.PL, ...ICAB_PAPERS_CATALOG.AL].find(p => p.date === item.date);
  return hit ? hit.code : '';
};

/** 'Assurance (AA)' / 'Financial Accounting & Reporting (FAR)'; an off day stays 'Off Day' */
export const routineSubject = (item: IcabExamScheduleItem): string => {
  const code = routineCode(item);
  return code ? `${item.subject} (${code})` : item.subject;
};

/** '2026-11-01' -> '01 Nov 26' (anything that is not a YYYY-MM-DD date is returned as it is) */
export const formatShortDate = (dateStr: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return dateStr;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${m[3]} ${months[Number(m[2]) - 1]} ${m[1].slice(2)}`;
};

/** A rejected application does not take the person out of the office. */
export const countsAsLeave = (r: StaffExamLeaveRecord): boolean => r.status !== 'Rejected';

class ExamLeaveService {
  /** Last list loaded from the database; the synchronous lookups below (task warning) read from it. */
  private cache: StaffExamLeaveRecord[] = [];

  private getStorage(): StaffExamLeaveRecord[] {
    return this.cache;
  }

  // ---- leaves that were saved only in this browser (before the database) -----------------------------------
  /** Why each leave still on this computer could not be uploaded (kept in memory for the notice in the tab) */
  private pendingReasons = new Map<string, string>();

  private readLocal(): StaffExamLeaveRecord[] {
    try {
      OLD_STORAGE_KEYS.forEach(k => localStorage.removeItem(k));
      const stored = localStorage.getItem(STORAGE_KEY);
      const list = stored ? (JSON.parse(stored) as StaffExamLeaveRecord[]) : [];
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  private writeLocal(list: StaffExamLeaveRecord[]): void {
    try {
      if (list.length === 0) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* ignore */
    }
  }

  /** Several old rows of one person (one per level) become the single leave a person has now. */
  private mergeByPerson(list: StaffExamLeaveRecord[]): StaffExamLeaveRecord[] {
    const out: StaffExamLeaveRecord[] = [];
    list.forEach(rec => {
      const hit = out.find(o => sameName(o.name, rec.name));
      if (!hit) {
        out.push({ ...rec, leaveDates: [...rec.leaveDates] });
        return;
      }
      const papers = [...getRecordPapers(hit), ...getRecordPapers(rec)];
      const levels = Array.from(new Set([...levelsOfRecord(hit), ...levelsOfRecord(rec)])).sort((x, y) => LEVEL_ORDER.indexOf(x) - LEVEL_ORDER.indexOf(y));
      const dates = Array.from(new Set([...hit.leaveDates, ...rec.leaveDates])).sort();
      const lastExams = [hit.appearInLastExamDate, rec.appearInLastExamDate].filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
      hit.level = levels.join(' & ') || hit.level;
      hit.papers = papers.length > 0 ? papers : hit.papers;
      hit.subjects = levels.length > 1 ? [hit, rec].map(r => `${r.level}\n${r.subjects}`).join('\n') : `${hit.subjects}\n${rec.subjects}`;
      hit.leaveDates = dates;
      hit.totalLeaveDays = `${dates.length} Days`;
      hit.leaveStartDay = dates[0] || hit.leaveStartDay;
      hit.appearInLastExamDate = lastExams[lastExams.length - 1] || hit.appearInLastExamDate;
    });
    return out;
  }

  /** Leaves still on this computer waiting to reach the database, with the reason when an upload failed */
  getPendingLocalLeaves(): { id: string; name: string; reason: string }[] {
    return this.readLocal().map(r => ({ id: r.id, name: r.name, reason: this.pendingReasons.get(r.id) || '' }));
  }

  /** Uploads the leaves kept only in this browser. A leave leaves this computer only once it is safely in the
   *  database (or is already there); anything that fails stays here and is reported, never thrown away. */
  async uploadLocalLeaves(): Promise<void> {
    const local = this.readLocal();
    if (local.length === 0) return;
    const merged = this.mergeByPerson(local);
    const remaining: StaffExamLeaveRecord[] = [];
    this.pendingReasons.clear();
    for (const rec of merged) {
      try {
        await api.callBackend('examLeaveSave', { record: rec });
      } catch (e: any) {
        const msg: string = e?.message || 'Could not upload.';
        // a leave for this person is already in the database: this copy is not needed
        if (/already submitted/i.test(msg)) continue;
        remaining.push(rec);
        this.pendingReasons.set(
          rec.id,
          /not allowed/i.test(msg) ? 'This leave is not under your own name. Ask the Admin to add it.' : msg
        );
      }
    }
    this.writeLocal(remaining);
  }

  /** Is the Exam Leave tab switched on for everyone? (Admin turns it on for exam time.) */
  async isEnabled(): Promise<boolean> {
    return api.callBackend<boolean>('examLeaveEnabledGet', {});
  }

  async setEnabled(enabled: boolean): Promise<void> {
    await api.callBackend('examLeaveEnabledSet', { enabled });
  }

  /** The leaves the signed-in person is allowed to see (the database decides). */
  async getLeaves(): Promise<StaffExamLeaveRecord[]> {
    await this.uploadLocalLeaves();
    const list = await api.callBackend<StaffExamLeaveRecord[]>('examLeaveList', {});
    this.cache = Array.isArray(list) ? list : [];
    return this.cache;
  }

  async saveLeave(record: StaffExamLeaveRecord): Promise<StaffExamLeaveRecord> {
    await api.callBackend('examLeaveSave', { record });
    return record;
  }

  async deleteLeave(id: string): Promise<boolean> {
    await api.callBackend('examLeaveDelete', { id });
    return true;
  }

  async approveLeave(id: string): Promise<void> {
    await api.callBackend('examLeaveStatus', { id, status: 'Approved' });
  }

  async rejectLeave(id: string): Promise<void> {
    await api.callBackend('examLeaveStatus', { id, status: 'Rejected' });
  }

  getIcabSchedule(): IcabExamScheduleItem[] {
    return OFFICIAL_ICAB_SCHEDULE;
  }

  getDates(): string[] {
    return EXAM_TIMELINE_DATES;
  }

  isStaffOnLeave(staffName: string, dateStr: string): boolean {
    if (!staffName || !dateStr) return false;
    return this.getStorage().some(r => countsAsLeave(r) && sameName(r.name, staffName) && r.leaveDates.includes(dateStr));
  }

  getStaffLeaveDetail(staffName: string): StaffExamLeaveRecord | undefined {
    if (!staffName) return undefined;
    // A person can have a PL, CL and AL record: combine them into one summary
    const mine = this.getStorage().filter(r => countsAsLeave(r) && sameName(r.name, staffName));
    if (mine.length === 0) return undefined;
    if (mine.length === 1) return mine[0];
    const dates = Array.from(new Set(mine.flatMap(r => r.leaveDates))).sort();
    const lastExams = mine.map(r => r.appearInLastExamDate).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
    return {
      ...mine[0],
      level: mine.map(r => r.level).join(' & '),
      totalLeaveDays: `${dates.length} Days`,
      leaveStartDay: dates[0] || mine[0].leaveStartDay,
      appearInLastExamDate: lastExams[lastExams.length - 1] || mine[0].appearInLastExamDate,
      leaveDates: dates
    };
  }

  async exportToExcel(
    allRecords: StaffExamLeaveRecord[],
    dates: string[],
    totalStaff?: number,
    clientResolver?: (r: StaffExamLeaveRecord) => { primaryClient: string; allClients: string }
  ): Promise<void> {
    const ExcelJS = (await import('exceljs')).default;
    const records = allRecords.filter(countsAsLeave);
    const staffTotal = Math.max(totalStaff || 0, countPeople(records));
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

    // Column widths: A spacer, B SL, C Name, D Primary Client, E All Clients, F Subjects, G Level, H-J leave info, then one narrow column per day
    const FIRST_DAY_COL = 11;
    sheet.getColumn(1).width = 2;
    [5, 30, 26, 30, 34, 9, 16, 14, 18].forEach((w, i) => { sheet.getColumn(i + 2).width = w; });
    dates.forEach((_, i) => { sheet.getColumn(FIRST_DAY_COL + i).width = 6; });
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
        dc.numFmt = 'dd mmm yy';
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

    // --- Row 17: total manpower (type a new number here and every "available" figure below updates)
    sheet.getCell(17, 9).value = 'Total Manpower:';
    sheet.getCell(17, 9).font = { bold: true };
    sheet.getCell(17, 9).alignment = { horizontal: 'right', vertical: 'middle' };
    const TOTAL_CELL = '$J$17';
    const totalManpowerCell = sheet.getCell(17, 10);
    totalManpowerCell.value = staffTotal;
    totalManpowerCell.font = { bold: true, color: { argb: 'FF1B2A6B' } };
    totalManpowerCell.fill = fill('FFEEF0F8');
    totalManpowerCell.alignment = { horizontal: 'center', vertical: 'middle' };
    totalManpowerCell.border = box;

    // --- Row 18: available manpower, row 19: headers
    const HEADER_ROW = 19;
    sheet.getCell(18, 10).value = 'Available Manpower';
    sheet.getCell(18, 10).font = { bold: true };
    const headers = ['SL', 'Name', 'Primary Client', 'All Clients', 'Subjects', 'Level', 'Total Leave Days', 'Leave Start Day', 'Appear in Last Exam Date'];
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
      cell.numFmt = 'dd mmm';
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

    // Column letters, for the formulas
    const firstDayLetter = sheet.getColumn(FIRST_DAY_COL).letter;
    const lastDayLetter = sheet.getColumn(FIRST_DAY_COL + dates.length - 1).letter;
    const FIRST_DATA = HEADER_ROW + 1;
    const LAST_DATA = HEADER_ROW + records.length;
    const hasRows = records.length > 0;

    // --- Data rows (from row 20), numbered 1..n so deleted people leave no gaps.
    // A leave day is any non-empty cell in the day columns (a 1, or the exam code on the exam day), so the
    // totals below are formulas: add, remove or retype a mark in Excel and every total follows.
    records.forEach((rec, rIdx) => {
      const rowNo = FIRST_DATA + rIdx;
      const row = sheet.getRow(rowNo);
      const startDate = toDate(rec.leaveStartDay);
      const lastExam = toDate(rec.appearInLastExamDate);

      let primaryClient = '—';
      let allClientsStr = rec.category || '—';
      if (clientResolver) {
        const resolved = clientResolver(rec);
        primaryClient = resolved.primaryClient || '—';
        allClientsStr = resolved.allClients || '—';
      } else if (rec.category && rec.category.trim()) {
        const parts = rec.category.split(',').map(s => s.trim()).filter(Boolean);
        primaryClient = parts[0] || '—';
        allClientsStr = rec.category.trim();
      }

      const values: (string | number | Date | null)[] = [
        rIdx + 1,
        rec.name,
        primaryClient,
        allClientsStr,
        rec.subjects,
        rec.level,
        null,
        startDate || (rec.leaveStartDay === '—' ? '' : rec.leaveStartDay),
        lastExam || (rec.appearInLastExamDate === '—' ? '' : rec.appearInLastExamDate)
      ];
      values.forEach((v, i) => {
        const cell = row.getCell(i + 2);
        cell.value = v;
        cell.border = box;
        cell.alignment = { vertical: 'middle', horizontal: i === 1 || i === 2 || i === 3 || i === 4 ? 'left' : 'center', wrapText: true };
        if (v instanceof Date) cell.numFmt = 'dd mmm yy';
      });
      // keep tall subject lists readable
      const lines = String(rec.subjects || '').split('\n').length;
      row.height = Math.max(20, lines * 15);

      dates.forEach((d, dIdx) => {
        const cell = row.getCell(FIRST_DAY_COL + dIdx);
        cell.border = box;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        if (rec.leaveDates.includes(d)) {
          const codes = examCodesOn(rec, d);
          cell.value = codes.length > 0 ? codes.join(' / ') : 1;
          cell.fill = fill('FFFFFF00');
          cell.font = { bold: true, size: codes.length > 0 ? 8 : 11 };
        } else if (isCentralHoliday(d)) {
          cell.fill = fill('FFFFC7CE');
        }
      });

      // Total days of this person = number of marked days (also shown as "N Days" in the label column)
      const range = `${firstDayLetter}${rowNo}:${lastDayLetter}${rowNo}`;
      const n = rec.leaveDates.filter(d => dates.includes(d)).length;
      const total = row.getCell(totalCol);
      total.value = { formula: `COUNTA(${range})`, result: n };
      total.font = { bold: true };
      total.alignment = { horizontal: 'center', vertical: 'middle' };
      total.border = box;
      const label = row.getCell(8);
      label.value = { formula: `COUNTA(${range})&" Days"`, result: `${n} Days` };
    });

    // --- Summary row under the table (formulas) + available manpower in row 18 (formulas)
    const SUMMARY_ROW = HEADER_ROW + 1 + records.length;
    const summaryRow = sheet.getRow(SUMMARY_ROW);
    summaryRow.getCell(10).value = 'Total on Leave:';
    summaryRow.getCell(9).font = { bold: true };
    summaryRow.getCell(9).alignment = { horizontal: 'right' };

    dates.forEach((d, dIdx) => {
      const col = FIRST_DAY_COL + dIdx;
      const letter = sheet.getColumn(col).letter;
      const count = countOnLeave(records, d);
      const sumCell = summaryRow.getCell(col);
      sumCell.value = hasRows ? { formula: `COUNTA(${letter}${FIRST_DATA}:${letter}${LAST_DATA})`, result: count } : 0;
      sumCell.font = { bold: true };
      sumCell.alignment = { horizontal: 'center' };
      sumCell.border = box;

      const availCell = sheet.getRow(18).getCell(col);
      availCell.value = { formula: `${TOTAL_CELL}-${letter}${SUMMARY_ROW}`, result: staffTotal - count };
      availCell.font = { bold: true };
      availCell.alignment = { horizontal: 'center' };
    });

    // Colours that follow the numbers: a marked day turns yellow, low availability turns red
    if (hasRows) {
      sheet.addConditionalFormatting({
        ref: `${firstDayLetter}${FIRST_DATA}:${lastDayLetter}${LAST_DATA}`,
        rules: [{ type: 'expression', priority: 1, formulae: [`LEN(${firstDayLetter}${FIRST_DATA})>0`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFFF00' } } } }]
      });
    }
    sheet.addConditionalFormatting({
      ref: `${firstDayLetter}18:${lastDayLetter}18`,
      rules: [{ type: 'expression', priority: 2, formulae: [`AND(ISNUMBER(${firstDayLetter}18),${firstDayLetter}18<=7)`], style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFCA5A5' } } } }]
    });
    workbook.calcProperties.fullCalcOnLoad = true;

    if (hasRows) {
      sheet.autoFilter = {
        from: { row: HEADER_ROW, column: 2 },
        to: { row: LAST_DATA, column: totalCol }
      };
    }

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
