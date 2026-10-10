import { parseCsv, parseSheetDate } from './staffSheet';
import { ProposalImportRow } from '../types';

export const PROPOSAL_STATUSES = [
  'Not Started', 'Draft', 'In Progress', 'Under Review', 'Submitted', 'On Hold',
  'Assigned To Other Team', 'Approved', 'Rejected'
];

export const PROPOSAL_TYPES = [
  'Statutory Audit', 'Internal Audit', 'Consulting', 'Assurance', 'Tax Advisory', 'IT/Cyber Advisory',
  'Audit', 'Consultancy', 'Advisory', 'Management Audit', 'Fixed Asset Audit', 'Tax', 'Others'
];

/** Rejected = discarded: not counted anywhere, only listed under "Show closed proposals". */
export const isClosedStatus = (status: string) => status === 'Rejected';

/** Already sent to the client (like a completed task): leaves the active list, opened by clicking SUBMITTED.
 *  "Under Review" is NOT here: it is the team's own review before the proposal is sent, so it is still ongoing. */
export const isSubmittedGroup = (status: string) => status === 'Submitted' || status === 'Approved';

/** Order of the Active list: the work being done first. (The status dropdown keeps PROPOSAL_STATUSES order.) */
const ACTIVE_ORDER = ['In Progress', 'Under Review', 'Draft', 'Not Started', 'On Hold', 'Assigned To Other Team'];

export const statusRank = (status: string) => {
  const i = ACTIVE_ORDER.indexOf(status);
  return i === -1 ? ACTIVE_ORDER.length : i;
};

/** Nearest deadline first; proposals without a deadline go last. */
export const compareDeadline = (a: string, b: string) => (a || '9999-99-99').localeCompare(b || '9999-99-99');

/** Whole days from today to the date (negative = overdue); null when there is no date. */
export function daysLeft(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - now.getTime()) / 86400000);
}

export const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  'Draft': { bg: '#E5E7EB', fg: '#4B5563' },
  'In Progress': { bg: '#FEF3C7', fg: '#92400E' },
  'Submitted': { bg: '#DBEAFE', fg: '#1E40AF' },
  'Under Review': { bg: '#EDE9FE', fg: '#5B21B6' },
  'On Hold': { bg: '#FEE2E2', fg: '#991B1B' },
  'Approved': { bg: '#16A34A', fg: '#FFFFFF' },
  'Rejected': { bg: '#DC2626', fg: '#FFFFFF' },
  'Not Started': { bg: '#E2E8F0', fg: '#334155' },
  'Assigned To Other Team': { bg: '#64748B', fg: '#FFFFFF' }
};

// ---------------------------------------------------------------- Google Sheet CSV import
export type DateOrder = 'DMY' | 'MDY';

const strip = (s: string) => s.replace(/[‎‏‪-‮]/g, '').trim();

/** "2026-07-07" -> same; "07/07/2026" -> by order; "7-Jul-2026" -> parsed. '' when it is not a date. */
export function parseProposalDate(raw: string, order: DateOrder): string {
  const s = strip(raw);
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/);
  if (m) {
    const y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    const [a, b] = [Number(m[1]), Number(m[2])];
    const [d, mo] = order === 'DMY' ? [a, b] : [b, a];
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return '';
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return parseSheetDate(s);
}

/** Looks at all the "a/b/yyyy" dates: a number above 12 shows which side is the day. */
export function detectDateOrder(table: string[][], dateCols: number[]): DateOrder {
  let dmy = 0;
  let mdy = 0;
  table.slice(1).forEach(r =>
    dateCols.forEach(c => {
      const m = strip(r[c] || '').match(/^(\d{1,2})[-./](\d{1,2})[-./]\d{2,4}$/);
      if (!m) return;
      if (Number(m[1]) > 12) dmy++;
      if (Number(m[2]) > 12) mdy++;
    })
  );
  return mdy > dmy ? 'MDY' : 'DMY';
}

const norm = (h: string) => strip(h).toLowerCase().replace(/[^a-z]/g, '');
const HEADER_KEYS: Record<string, keyof ProposalImportRow> = {
  name: 'name', proposalname: 'name', client: 'client', type: 'type',
  assignedto: 'assignedTo', receivedate: 'receiveDate', deadline: 'deadline',
  status: 'status', remarks: 'remarks', remark: 'remarks'
};

export interface ParsedProposalSheet {
  rows: ProposalImportRow[];
  warnings: string[];
  order: DateOrder;
  headerOk: boolean;
}

/** Reads the "Proposals" tab of the old Google Sheet, downloaded as CSV. */
export function parseProposalSheet(text: string, forcedOrder?: DateOrder): ParsedProposalSheet {
  const table = parseCsv(text).filter(r => r.some(c => strip(c) !== ''));
  const warnings: string[] = [];
  if (table.length < 2) return { rows: [], warnings: ['The file is empty.'], order: 'DMY', headerOk: false };

  const header = table[0].map(norm);
  const col: Partial<Record<keyof ProposalImportRow, number>> = {};
  header.forEach((h, i) => {
    const k = HEADER_KEYS[h];
    if (k && col[k] === undefined) col[k] = i;
  });
  const headerOk = col.name !== undefined && col.client !== undefined;
  if (!headerOk) {
    return { rows: [], warnings: ['The first row must have the column names (name, client, type, assignedTo, receiveDate, deadline, status, remarks).'], order: 'DMY', headerOk };
  }

  const dateCols = [col.receiveDate, col.deadline].filter((c): c is number => c !== undefined);
  const order = forcedOrder || detectDateOrder(table, dateCols);

  const rows: ProposalImportRow[] = [];
  table.slice(1).forEach((r, idx) => {
    const get = (k: keyof ProposalImportRow) => (col[k] === undefined ? '' : strip(r[col[k] as number] || ''));
    const name = get('name');
    const client = get('client');
    if (!name && !client) return;
    const dates = (k: 'receiveDate' | 'deadline') => {
      const raw = get(k);
      const iso = parseProposalDate(raw, order);
      if (raw && !iso) warnings.push(`Row ${idx + 2}: "${raw}" is not a date, so ${k === 'deadline' ? 'the deadline' : 'the receive date'} was left empty.`);
      return iso;
    };
    const rawStatus = get('status');
    const status = PROPOSAL_STATUSES.find(s => s.toLowerCase() === rawStatus.toLowerCase()) || 'Draft';
    if (rawStatus && status === 'Draft' && rawStatus.toLowerCase() !== 'draft') {
      warnings.push(`Row ${idx + 2}: status "${rawStatus}" is not known, so it was set to Draft.`);
    }
    rows.push({
      name, client, type: get('type'), assignedTo: get('assignedTo'),
      receiveDate: dates('receiveDate'), deadline: dates('deadline'), status, remarks: get('remarks')
    });
  });
  return { rows, warnings, order, headerOk };
}

/** Splits text into plain parts and web links, so links in remarks can be clicked. */
export function splitLinks(text: string): { text: string; url?: string }[] {
  const out: { text: string; url?: string }[] = [];
  const re = /(https?:\/\/[^\s<>"']+)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[1], url: m[1] });
    last = m.index + m[1].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

const TITLES = new Set(['md', 'md.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'dr', 'dr.', 'mohammad', 'mohammed', 'muhammad', 'mohd', 'mohd.', 'engr.', 'engr']);

/** "Md. Ashraf Hossain Emon" -> "Ashraf": the first real name, skipping titles like Md. / Mr. */
export function firstName(full: string): string {
  const words = full.trim().split(/\s+/).filter(Boolean);
  const real = words.find(w => !TITLES.has(w.toLowerCase()));
  return real || words[0] || full;
}

/** A name that fits a narrow column: short names stay as they are, long ones become the first name. */
export function shortPerson(full: string, max = 12): string {
  const t = full.trim();
  return t.length <= max ? t : firstName(t);
}

/** The first words of a label that fit in max characters ("Management Audit" -> "Management"). */
export function shortText(text: string, max: number): string {
  const t = (text || '').trim();
  if (t.length <= max) return t;
  const words = t.split(/\s+/);
  let out = '';
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > max) break;
    out = next;
  }
  return out || `${t.slice(0, max - 1)}…`;
}

const SHORT_STATUS: Record<string, string> = { 'Assigned To Other Team': 'Other Team' };
export const shortStatus = (status: string) => SHORT_STATUS[status] || shortText(status, 13);
