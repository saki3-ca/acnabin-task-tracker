// Reads the staff sheet (exported from Google Sheets as CSV) and turns it into clean records
// for the import function. Columns are matched by header name, so order and extra columns don't matter.

import { canonicalPrincipal } from './academicYear';
import { titleCaseWords } from './text';

export interface StaffRow {
  emp_id: string;
  name?: string;
  department?: string;
  designation?: string;
  academic_year?: string;
  client_names?: string;
  articleship_period?: string;
  articleship_start?: string;
  articleship_end?: string;
  principal_name?: string;
  mobile?: string;
  email?: string;
  joining_date?: string;
  blood_group?: string;
  emergency_name?: string;
  emergency_relationship?: string;
  emergency_phone?: string;
  present_address?: string;
  laptop_available?: string;
  laptop_ownership?: string;
  laptop_id?: string;
  remarks?: string;
  extra?: Record<string, string>;
}

/** Minimal CSV reader: quotes, escaped quotes, commas and line breaks inside cells, BOM. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some(c => c.trim() !== '')) rows.push(row);
  return rows;
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const strip = (s: string) => s.replace(/[‎‏‪-‮]/g, '').replace(/\s+/g, ' ').trim();
const iso = (y: number, m: number, d: number) => {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
    ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    : '';
};

/** "1-Jul-2024", "01-Dec-25", "23 April 2025", "09-12-2024", "10.06.2026" -> "2024-07-01" ('' when not a date) */
export function parseSheetDate(raw: string): string {
  const s = strip(raw);
  let m = s.match(/^(\d{1,2})[-./ ]+([A-Za-z]+)[-./ ,]+(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    const y = Number(m[3]);
    return mo ? iso(y < 100 ? 2000 + y : y, mo, Number(m[1])) : '';
  }
  m = s.match(/^(\d{1,2})[-./ ]+(\d{1,2})[-./ ]+(\d{2,4})$/);
  if (m) {
    const y = Number(m[3]);
    return iso(y < 100 ? 2000 + y : y, Number(m[2]), Number(m[1]));
  }
  return '';
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2023-06-09" -> "09 Jun 2023" ('' when it is not an ISO date) */
export function formatPeriodDate(isoDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate || '');
  return m && MONTH_NAMES[Number(m[2]) - 1] ? `${m[3]} ${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}` : '';
}

/** The one format used for every articleship period: "09 Jun 2023 to 08 Jun 2027" */
export function formatPeriod(startIso: string, endIso: string): string {
  const a = formatPeriodDate(startIso);
  const b = formatPeriodDate(endIso);
  return a && b ? `${a} to ${b}` : '';
}

/** "09-12-2024 to 08-12-2027" -> start/end */
export function parsePeriod(raw: string): { start: string; end: string } {
  // "21 April 2024-20 April 2027" (dash with no spaces) -> "21 April 2024 to 20 April 2027"
  const s = strip(raw).replace(/(\d)\s*[-–]\s*(?=\d{1,2}\s+[A-Za-z]{3,})/, '$1 to ');
  if (!s) return { start: '', end: '' };
  const parts = s.split(/\s+to\s+|\s+[-–]\s+|\s*–\s*/i);
  return parts.length === 2 ? { start: parseSheetDate(parts[0]), end: parseSheetDate(parts[1]) } : { start: '', end: '' };
}

export function normalizeEmpId(raw: string): string {
  const m = strip(raw).toUpperCase().replace(/\s+/g, '').match(/^(STD|EMP)-?0*(\d+)$/);
  return m ? `${m[1]}-${String(Number(m[2])).padStart(6, '0')}` : '';
}

export function normalizeMobile(raw: string): string {
  let d = strip(raw).replace(/\D/g, '');
  if (d.startsWith('880')) d = d.slice(2);
  if (/^1\d{9}$/.test(d)) d = '0' + d;
  return /^01\d{9}$/.test(d) ? d : '';
}

const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export function normalizeBlood(raw: string): string {
  const v = strip(raw).toUpperCase().replace(/^0/, 'O').replace(/\s+/g, '');
  return BLOOD.includes(v) ? v : '';
}

function normalizeYear(raw: string): string {
  const m = strip(raw).match(/^(\d)(?:st|nd|rd|th)?\s*year$/i);
  return m ? `${m[1]}${['th', 'st', 'nd', 'rd', 'th'][Number(m[1])] ?? 'th'} Year` : '';
}

function normalizeDesignation(raw: string): string {
  const v = strip(raw);
  if (/^article student$/i.test(v)) return 'Student';
  if (/^sam$/i.test(v)) return 'Senior Assistant Manager';
  return v;
}

// header (lower-cased, letters only) -> field
const HEADERS: Record<string, keyof StaffRow | 'client1' | 'client2' | 'client3' | 'skip'> = {
  empstd: 'emp_id', empid: 'emp_id', stdemp: 'emp_id', id: 'emp_id',
  name: 'name', department: 'department', category: 'designation', designation: 'designation',
  year: 'academic_year', assignedclient1: 'client1', assignedclient2: 'client2', assignedclient3: 'client3',
  articleshipperiod: 'articleship_period', principlename: 'principal_name', principalname: 'principal_name',
  mobileno: 'mobile', mobile: 'mobile', email: 'email',
  bloodgroup: 'blood_group', emergencycontactpersonname: 'emergency_name', emergencycellno: 'emergency_phone',
  relationship: 'emergency_relationship', presentaddress: 'present_address',
  laptopavailablitystatus: 'laptop_available', laptopavailabilitystatus: 'laptop_available',
  laptopownershipstatus: 'laptop_ownership', laptopidentificationnumber: 'laptop_id', remark: 'remarks', remarks: 'remarks',
  slno: 'skip'
};
const key = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');

export function normalizeStaffSheet(table: string[][]): { rows: StaffRow[]; warnings: string[] } {
  const warnings: string[] = [];
  if (table.length < 2) return { rows: [], warnings: ['The file has no data rows.'] };
  const headers = table[0].map(h => strip(h));
  const byId = new Map<string, StaffRow>();
  const seen = new Map<string, number>();

  table.slice(1).forEach((cells, idx) => {
    const line = idx + 2;
    const rec: Record<string, string> = {};
    const extra: Record<string, string> = {};
    let c1 = '', c2 = '', c3 = '', joiningRaw = '';
    headers.forEach((h, i) => {
      const v = strip(cells[i] ?? '');
      if (!v) return;
      const k = key(h);
      const target = HEADERS[k];
      if (k.startsWith('joiningdate')) joiningRaw = v;
      else if (target === 'client1') c1 = v;
      else if (target === 'client2') c2 = v;
      else if (target === 'client3') c3 = v;
      else if (target === 'skip') { /* serial number */ }
      else if (target) rec[target] = v;
      else if (h) extra[h] = v;
    });

    const empId = normalizeEmpId(rec.emp_id || '');
    if (!empId) {
      if (Object.keys(rec).length > 0) warnings.push(`Row ${line}: "${rec.emp_id || ''}" is not a valid EMP/STD ID, skipped.`);
      return;
    }
    const isEmp = empId.startsWith('EMP');
    const row: StaffRow = { emp_id: empId };
    const set = (k: keyof StaffRow, v: string) => { if (v) (row as unknown as Record<string, string>)[k] = v; };

    set('name', rec.name || '');
    set('department', rec.department || '');
    set('designation', normalizeDesignation(rec.designation || ''));
    set('client_names', [c1, c2, c3].filter(Boolean).join(', '));
    set('email', (rec.email || '').toLowerCase());

    const mobile = normalizeMobile(rec.mobile || '');
    if (rec.mobile && !mobile) warnings.push(`${empId}: mobile "${rec.mobile}" looks wrong, left blank.`);
    set('mobile', mobile);
    const ePhone = normalizeMobile(rec.emergency_phone || '');
    if (rec.emergency_phone && !ePhone) warnings.push(`${empId}: emergency mobile "${rec.emergency_phone}" looks wrong, left blank.`);
    set('emergency_phone', ePhone);

    const blood = normalizeBlood(rec.blood_group || '');
    if (rec.blood_group && !blood) warnings.push(`${empId}: blood group "${rec.blood_group}" is not valid, left blank.`);
    set('blood_group', blood);

    set('emergency_name', rec.emergency_name || '');
    set('emergency_relationship', rec.emergency_relationship || '');
    set('present_address', titleCaseWords(rec.present_address || ''));
    set('laptop_available', /^y/i.test(rec.laptop_available || '') ? 'Yes' : /^n/i.test(rec.laptop_available || '') ? 'No' : '');
    set('laptop_ownership', rec.laptop_ownership || '');
    set('laptop_id', /^(n\/?a|not (mentioned|tagged))$/i.test(rec.laptop_id || '') ? '' : rec.laptop_id || '');
    set('remarks', /^n\/?a$/i.test(rec.remarks || '') ? '' : rec.remarks || '');

    const joining = joiningRaw ? parseSheetDate(joiningRaw) : '';
    if (joiningRaw && !joining) warnings.push(`${empId}: joining date "${joiningRaw}" not understood, left blank.`);
    set('joining_date', joining);

    if (isEmp) {
      // Employees have no academic year, articleship or principal
    } else {
      set('academic_year', normalizeYear(rec.academic_year || ''));
      if (rec.articleship_period && !/^n\/?a$/i.test(rec.articleship_period)) {
        const { start, end } = parsePeriod(rec.articleship_period);
        if (!start) warnings.push(`${empId}: articleship period "${rec.articleship_period}" not understood, dates left blank.`);
        // saved in one format, whatever way the sheet wrote it; unreadable text is kept as typed
        set('articleship_period', formatPeriod(start, end) || strip(rec.articleship_period));
        set('articleship_start', start);
        set('articleship_end', end);
      }
      if (rec.principal_name) set('principal_name', canonicalPrincipal(rec.principal_name));
    }
    if (Object.keys(extra).length) row.extra = extra;

    seen.set(empId, (seen.get(empId) || 0) + 1);
    const prev = byId.get(empId);
    if (prev) {
      // same person twice: keep the first row's values, fill any blanks from the later row
      for (const [k, v] of Object.entries(row)) {
        if (k === 'extra') prev.extra = { ...(row.extra || {}), ...(prev.extra || {}) };
        else if (!(prev as unknown as Record<string, string>)[k]) (prev as unknown as Record<string, string>)[k] = v as string;
      }
    } else byId.set(empId, row);
  });

  for (const [id, n] of seen) if (n > 1) warnings.push(`${id} appears ${n} times in the file; merged into one record.`);
  return { rows: [...byId.values()], warnings };
}
