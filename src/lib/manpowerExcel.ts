// Builds the styled Manpower workbook downloaded from the Manpower tab.
// Seven sheets: Client Summary, Secondary Clients, Designation Mix, Staff by Client,
// Staff Detail by Client, Staff List (the data) and Notes. Totals are live Excel formulas
// that read from the Staff List sheet, so the file keeps adding up if someone edits it.
// exceljs is loaded only when someone downloads, so it does not slow the app down.
import type { Cell, Row, Worksheet } from 'exceljs';
import { academicYearFromStart, employmentYearFromJoining, isEmployeeId, principalDisplay } from './academicYear';
import { MyStaff } from '../types';

/** One person in the Manpower tab, with the client names and job IDs kept apart. */
export interface ExportPerson {
  empId: string;
  name: string;
  designation: string;
  academicYear: string;
  primaryName: string;
  primaryCode: string;
  secondary: { name: string; code: string }[];
  salary: number;
  conveyance: number;
  mobile: string;
  email: string;
  remarks: string;
}

export interface ExportClient {
  name: string;
  code: string;
}

/**
 * Clients that are downloaded as ONE client. Staff and cost of every member are counted together
 * and the client is shown as "Name 1,<line break>Name 2". Add another list here to merge more.
 */
export const MERGED_CLIENT_GROUPS: string[][] = [['Spacezero Limited', 'Volumezero Limited']];

const ALL_CLIENTS = 'All Clients';
const UNASSIGNED = 'Unassigned';
const SHEET = "'Staff List'";

const NAVY = 'FF1F3864';
const GREY_FILL = 'FFF2F2F2';
const SUB_FILL = 'FFDDEBF7';
const AMBER = 'FFFFE699';
const LINE = { style: 'thin' as const, color: { argb: 'FFBFBFBF' } };
const BORDER = { top: LINE, left: LINE, bottom: LINE, right: LINE };
const FONT = 'Arial';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

const toDate = (iso?: string): Date | null => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const longDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Designation groups used by the summary columns, in reporting order
const LEADERSHIP = ['Partner', 'Director', 'Deputy Director', 'Assistant Director'];
const MANAGERS = ['Manager', 'Deputy Manager', 'Senior Assistant Manager'];
const IN_CHARGE = ['In Charge', 'Supervisor'];
const MIX_BASE = ['Director', 'Deputy Director', 'Assistant Director', 'Deputy Manager', 'Senior Assistant Manager', 'In Charge', 'Student', 'Trainee'];
const MIX_EXTRA = ['Partner', 'Manager', 'Supervisor'];
const RANK = ['Partner', 'Director', 'Deputy Director', 'Assistant Director', 'Manager', 'Deputy Manager', 'Senior Assistant Manager', 'Supervisor', 'In Charge', 'Student', 'Trainee'];
const rankOf = (d: string) => {
  const i = RANK.findIndex(r => norm(r) === norm(d));
  return i === -1 ? RANK.length : i;
};

interface Group { label: string; code: string }

type Fx = { formula: string; result: number | string };
const fx = (formula: string, result: number | string): Fx => ({ formula, result });

interface Person extends ExportPerson {
  primary: Group;
  secondaryLabels: string[];
  st?: MyStaff;
}

export async function buildManpowerWorkbook(
  people: ExportPerson[],
  clientOrder: ExportClient[],
  staff: MyStaff[]
): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ACNABIN Task Tracker';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const now = new Date();
  const asAt = longDate(now);
  const subtitle = `ACNABIN Chartered Accountants  |  Manpower as at ${asAt}  |  Prepared ${asAt}`;

  // ------------------------------------------------------------ client names, with merged clients joined
  const codeByName = new Map<string, string>();
  const rememberCode = (name: string, code: string) => {
    if (name && code && !codeByName.has(norm(name))) codeByName.set(norm(name), code);
  };
  clientOrder.forEach(c => rememberCode(c.name, c.code));
  people.forEach(p => {
    rememberCode(p.primaryName, p.primaryCode);
    p.secondary.forEach(s => rememberCode(s.name, s.code));
  });

  const resolve = (name: string, code: string): Group => {
    const n = (name || '').trim();
    if (!n) return { label: UNASSIGNED, code: '-' };
    if (n === ALL_CLIENTS) return { label: ALL_CLIENTS, code: '-' };
    const grp = MERGED_CLIENT_GROUPS.find(g => g.some(m => norm(m) === norm(n)));
    if (grp) {
      const codes = grp.map(m => codeByName.get(norm(m))).filter((c): c is string => Boolean(c));
      return { label: grp.join(',\n'), code: codes.length ? codes.join(',\n') : code || '-' };
    }
    return { label: n, code: code || '-' };
  };

  const byId = new Map(staff.map(s => [s.empId.trim().toUpperCase(), s]));

  const list: Person[] = people.map(p => {
    const primary = resolve(p.primaryName, p.primaryCode);
    const seen = new Set<string>([primary.label]);
    const secondaryLabels: string[] = [];
    p.secondary.forEach(s => {
      const g = resolve(s.name, s.code);
      if (g.label === ALL_CLIENTS || g.label === UNASSIGNED || seen.has(g.label)) return;
      seen.add(g.label);
      secondaryLabels.push(g.label);
    });
    return { ...p, primary, secondaryLabels, st: byId.get(p.empId.trim().toUpperCase()) };
  });

  // Clients in the order of the Manpower summary, then All Clients, then anyone with no client
  const clients: Group[] = [];
  const addClient = (g: Group) => {
    if (!clients.some(c => c.label === g.label)) clients.push(g);
  };
  clientOrder.forEach(c => {
    const g = resolve(c.name, c.code);
    if (g.label !== ALL_CLIENTS && g.label !== UNASSIGNED) addClient(g);
  });
  list.forEach(p => {
    if (p.primary.label !== ALL_CLIENTS && p.primary.label !== UNASSIGNED) addClient(p.primary);
  });
  if (list.some(p => p.primary.label === ALL_CLIENTS)) addClient({ label: ALL_CLIENTS, code: '-' });
  if (list.some(p => p.primary.label === UNASSIGNED)) addClient({ label: UNASSIGNED, code: '-' });
  const clientIndex = new Map(clients.map((c, i) => [c.label, i]));

  // Group order for the "by client" sheets; the Staff List puts leadership first
  const grouped = [...list].sort((a, b) => {
    const ca = clientIndex.get(a.primary.label) ?? 999;
    const cb = clientIndex.get(b.primary.label) ?? 999;
    if (ca !== cb) return ca - cb;
    const r = rankOf(a.designation) - rankOf(b.designation);
    return r !== 0 ? r : a.name.localeCompare(b.name);
  });
  const staffListOrder = [
    ...grouped.filter(p => p.primary.label === ALL_CLIENTS),
    ...grouped.filter(p => p.primary.label !== ALL_CLIENTS)
  ];

  // ------------------------------------------------------------ small helpers
  const total = list.length;
  const LIST_FIRST = 5;
  const LIST_LAST = LIST_FIRST + Math.max(total, 1) - 1;
  const rng = (col: string) => `${SHEET}!$${col}$${LIST_FIRST}:$${col}$${LIST_LAST}`;
  const listRowOf = new Map<Person, number>(staffListOrder.map((p, i) => [p, LIST_FIRST + i]));
  const money = (p: Person) => (Number(p.salary) || 0) + (Number(p.conveyance) || 0);
  const secText = (p: Person) => (p.secondaryLabels.length ? p.secondaryLabels.join(', ') : '-');
  const totalCost = list.reduce((a, p) => a + money(p), 0);

  const colWidth = (ws: Worksheet, widths: number[]) => widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
  const lineCount = (text: string, width: number) =>
    String(text)
      .split('\n')
      .reduce((a, l) => a + Math.max(1, Math.ceil(l.length / Math.max(1, width * 1.05))), 0);

  const sheetBase = (name: string, title: string, sub: string, frozen?: { x: number; y: number }, tab = NAVY) => {
    const ws = wb.addWorksheet(name, {
      views: [{ state: frozen ? 'frozen' : 'normal', xSplit: frozen?.x ?? 0, ySplit: frozen?.y ?? 0, showGridLines: false }]
    });
    ws.getCell('A1').value = title;
    ws.getCell('A1').font = { name: FONT, size: 14, bold: true, color: { argb: NAVY } };
    ws.getCell('A2').value = sub;
    ws.getCell('A2').font = { name: FONT, size: 9, italic: true, color: { argb: 'FF595959' } };
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    ws.headerFooter.oddFooter = `&L&8ACNABIN Chartered Accountants - ${name}&C&8Confidential&R&8Page &P of &N`;
    ws.properties.tabColor = { argb: tab };
    return ws;
  };

  const headerRow = (ws: Worksheet, row: number, headers: string[], height = 30) => {
    const r = ws.getRow(row);
    headers.forEach((h, i) => (r.getCell(i + 1).value = h));
    r.height = height;
    headers.forEach((_, i) => {
      const c = r.getCell(i + 1);
      c.font = { name: FONT, size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = BORDER;
    });
  };

  type Align = 'left' | 'center' | 'right';
  const body = (c: Cell, align: Align, opts: { bold?: boolean; fill?: string; fmt?: string; color?: string; vertical?: 'top' | 'middle' } = {}) => {
    c.font = { name: FONT, size: 10, bold: opts.bold, color: opts.color ? { argb: opts.color } : undefined };
    c.alignment = { horizontal: align, vertical: opts.vertical ?? 'middle', wrapText: true };
    c.border = BORDER;
    if (opts.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } };
    if (opts.fmt) c.numFmt = opts.fmt;
  };

  const checkStyle = (c: Cell) => {
    c.font = { name: FONT, size: 8, italic: true, color: { argb: 'FF808080' } };
  };

  const noteRow = (ws: Worksheet, row: number, cols: number, text: string) => {
    ws.mergeCells(row, 1, row, cols);
    const c = ws.getCell(row, 1);
    c.value = text;
    c.font = { name: FONT, size: 9, italic: true, color: { argb: 'FF595959' } };
    c.alignment = { vertical: 'top', wrapText: true };
    ws.getRow(row).height = 28;
  };

  const countBy = (names: string[], label: string) =>
    list.filter(p => p.primary.label === label && names.some(n => norm(n) === norm(p.designation))).length;
  const countFormula = (names: string[], r: number) =>
    names.map(n => `COUNTIFS(${rng('F')},$B${r},${rng('D')},"${n}")`).join('+');

  // ============================================================ 1. Client Summary
  const ws1 = sheetBase('Client Summary', 'Client-wise Manpower Summary', subtitle, { x: 2, y: 4 });
  colWidth(ws1, [5, 40, 12, 10, 10, 12, 11, 9, 9, 9, 18, 13, 14, 11]);
  headerRow(ws1, 4, [
    'SL', 'Client', 'Client Code', 'Total Manpower', '% of Firm', 'Leadership\n(Dir/DD/AD)', 'Managers\n(DM/SAM)',
    'In Charge', 'Students', 'Trainees', 'Also Supported by\n(secondary staff)', 'Monthly Cost\n(BDT)', 'Avg Cost / Head\n(BDT)', '% of Firm Cost'
  ], 42);

  const S1_FIRST = 5;
  const S1_LAST = S1_FIRST + clients.length - 1;
  const S1_TOTAL = S1_LAST + 1;
  clients.forEach((c, i) => {
    const r = S1_FIRST + i;
    const mine = list.filter(p => p.primary.label === c.label);
    const headcount = mine.length;
    const cost = mine.reduce((a, p) => a + money(p), 0);
    const support = list.filter(p => p.secondaryLabels.includes(c.label)).length;
    const row = ws1.getRow(r);
    const lines = Math.max(lineCount(c.label, 40), lineCount(c.code, 12));
    row.height = Math.max(15, lines * 13);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = c.label;
    row.getCell(3).value = c.code;
    row.getCell(4).value = fx(`COUNTIF(${rng('F')},$B${r})`, headcount);
    row.getCell(5).value = fx(`D${r}/$D$${S1_TOTAL}`, total ? headcount / total : 0);
    row.getCell(6).value = fx(countFormula(['Director', 'Deputy Director', 'Assistant Director', 'Partner'], r), countBy(LEADERSHIP, c.label));
    row.getCell(7).value = fx(countFormula(['Deputy Manager', 'Senior Assistant Manager', 'Manager'], r), countBy(MANAGERS, c.label));
    row.getCell(8).value = fx(countFormula(['In Charge', 'Supervisor'], r), countBy(IN_CHARGE, c.label));
    row.getCell(9).value = fx(countFormula(['Student'], r), countBy(['Student'], c.label));
    row.getCell(10).value = fx(countFormula(['Trainee'], r), countBy(['Trainee'], c.label));
    row.getCell(11).value = fx(`SUMPRODUCT(--ISNUMBER(SEARCH(", "&$B${r}&",",", "&${rng('H')}&",")))`, support);
    row.getCell(12).value = fx(`SUMIF(${rng('F')},$B${r},${rng('K')})`, cost);
    row.getCell(13).value = fx(`IF(D${r}=0,0,L${r}/D${r})`, headcount ? cost / headcount : 0);
    row.getCell(14).value = fx(`L${r}/$L$${S1_TOTAL}`, totalCost ? cost / totalCost : 0);
    for (let n = 1; n <= 14; n++) {
      const c1 = row.getCell(n);
      body(c1, n === 2 ? 'left' : 'center', {
        bold: n === 4,
        fmt: n === 5 || n === 14 ? '0.0%' : n === 12 || n === 13 ? '#,##0' : undefined
      });
    }
  });

  const tr1 = ws1.getRow(S1_TOTAL);
  tr1.height = 15;
  tr1.getCell(2).value = 'FIRM TOTAL';
  tr1.getCell(4).value = fx(`SUM(D${S1_FIRST}:D${S1_LAST})`, total);
  tr1.getCell(5).value = fx(`SUM(E${S1_FIRST}:E${S1_LAST})`, total ? 1 : 0);
  const sumCol = (col: string) => `SUM(${col}${S1_FIRST}:${col}${S1_LAST})`;
  const bucketTotal = (names: string[]) => list.filter(p => names.some(n => norm(n) === norm(p.designation))).length;
  tr1.getCell(6).value = fx(sumCol('F'), bucketTotal(LEADERSHIP));
  tr1.getCell(7).value = fx(sumCol('G'), bucketTotal(MANAGERS));
  tr1.getCell(8).value = fx(sumCol('H'), bucketTotal(IN_CHARGE));
  tr1.getCell(9).value = fx(sumCol('I'), bucketTotal(['Student']));
  tr1.getCell(10).value = fx(sumCol('J'), bucketTotal(['Trainee']));
  tr1.getCell(12).value = fx(sumCol('L'), totalCost);
  tr1.getCell(13).value = fx(`L${S1_TOTAL}/D${S1_TOTAL}`, total ? totalCost / total : 0);
  tr1.getCell(14).value = fx(sumCol('N'), totalCost ? 1 : 0);
  for (let n = 1; n <= 14; n++) {
    body(tr1.getCell(n), n === 2 ? 'left' : 'center', {
      bold: true,
      fill: GREY_FILL,
      fmt: n === 5 || n === 14 ? '0.0%' : n === 12 || n === 13 ? '#,##0' : undefined
    });
  }
  const chk1 = ws1.getRow(S1_TOTAL + 1);
  chk1.getCell(2).value = 'Check: headcount and cost vs staff list (should be 0)';
  chk1.getCell(4).value = fx(`D${S1_TOTAL}-COUNTA(${rng('C')})`, 0);
  chk1.getCell(12).value = fx(`L${S1_TOTAL}-SUM(${rng('K')})`, 0);
  [2, 4, 12].forEach(n => checkStyle(chk1.getCell(n)));
  noteRow(
    ws1,
    S1_TOTAL + 3,
    14,
    'Amber = client has no manager (DM/SAM) assigned as primary. "Also supported by" = staff from other clients with this client as a secondary assignment. Leadership (Director, Deputy Director, Assistant Director) is shown under "All Clients". Cost = monthly salary/allowance + conveyance. Spacezero Limited and Volumezero Limited are treated as one client.'
  );
  // Data bars make the biggest teams and costs stand out at a glance
  if (clients.length > 0) {
    const bar = (ref: string, argb: string, priority: number) =>
      ws1.addConditionalFormatting({
        ref,
        rules: [{
          type: 'dataBar', priority, minLength: 0, maxLength: 100, showValue: true, gradient: false,
          cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb }
        } as never]
      });
    bar(`E${S1_FIRST}:E${S1_LAST}`, 'FF9DC3E6', 2);
    bar(`N${S1_FIRST}:N${S1_LAST}`, 'FFF4B183', 3);
  }
  const reportable = clients.filter(c => c.label !== ALL_CLIENTS && c.label !== UNASSIGNED).length;
  if (reportable > 0) {
    ws1.addConditionalFormatting({
      ref: `G${S1_FIRST}:G${S1_FIRST + reportable - 1}`,
      rules: [{ type: 'cellIs', operator: 'equal', formulae: ['0'], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: AMBER } } } }]
    });
  }

  // ============================================================ 2. Secondary Clients
  const ws2 = sheetBase('Secondary Clients', 'Secondary Client Coverage', subtitle, undefined, 'FFED7D31');
  colWidth(ws2, [5, 40, 12, 11, 14, 90]);
  headerRow(ws2, 4, ['SL', 'Client', 'Has Primary Staff?', 'Primary Staff', 'Supporting Staff (secondary)', 'Supporting Staff Names'], 30);
  const supportMap = new Map<string, Person[]>();
  staffListOrder.forEach(p => p.secondaryLabels.forEach(l => supportMap.set(l, [...(supportMap.get(l) || []), p])));
  const secondaryClients = [...supportMap.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  secondaryClients.forEach(([label, supporters], i) => {
    const r = 5 + i;
    const primaryCount = list.filter(p => p.primary.label === label).length;
    const names = supporters.map(p => p.name).join(', ');
    const row = ws2.getRow(r);
    row.height = Math.max(15, Math.max(lineCount(label, 40), lineCount(names, 90)) * 13);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = label;
    row.getCell(3).value = fx(`IF(D${r}>0,"Yes","No")`, primaryCount > 0 ? 'Yes' : 'No');
    row.getCell(4).value = fx(`COUNTIF(${rng('F')},B${r})`, primaryCount);
    row.getCell(5).value = fx(`SUMPRODUCT(--ISNUMBER(SEARCH(", "&$B${r}&",",", "&${rng('H')}&",")))`, supporters.length);
    row.getCell(6).value = names;
    for (let n = 1; n <= 6; n++) body(row.getCell(n), n === 2 || n === 6 ? 'left' : 'center');
  });
  if (secondaryClients.length > 0) {
    ws2.addConditionalFormatting({
      ref: `C5:C${4 + secondaryClients.length}`,
      rules: [{ type: 'cellIs', operator: 'equal', formulae: ['"No"'], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: AMBER } } } }]
    });
  }
  noteRow(ws2, 6 + secondaryClients.length, 6, 'Amber = client covered only through secondary assignments (no dedicated primary staff).');

  // ============================================================ 3. Designation Mix
  const ws3 = sheetBase('Designation Mix', 'Designation Mix', subtitle, undefined, 'FF70AD47');
  colWidth(ws3, [5, 28, 11, 10, 16, 18]);
  headerRow(ws3, 4, ['SL', 'Designation', 'Headcount', '% of Firm', 'Monthly Cost (BDT)', 'Avg Cost / Head (BDT)'], 24);
  const known = new Set([...MIX_BASE, ...MIX_EXTRA].map(norm));
  const otherDesignations = [...new Set(list.map(p => p.designation.trim()).filter(d => d && !known.has(norm(d))))].sort();
  const mix = [
    ...MIX_BASE,
    ...MIX_EXTRA.filter(d => list.some(p => norm(p.designation) === norm(d))),
    ...otherDesignations
  ];
  const noDesignation = list.filter(p => !p.designation.trim()).length;
  if (noDesignation > 0) mix.push('Not set');
  const MIX_TOTAL = 5 + mix.length;
  mix.forEach((d, i) => {
    const r = 5 + i;
    const mine = list.filter(p => (d === 'Not set' ? !p.designation.trim() : norm(p.designation) === norm(d)));
    const cost = mine.reduce((a, p) => a + money(p), 0);
    const row = ws3.getRow(r);
    row.height = 15;
    row.getCell(1).value = i + 1;
    row.getCell(2).value = d;
    row.getCell(3).value = d === 'Not set' ? fx(`COUNTBLANK(${rng('D')})`, mine.length) : fx(`COUNTIF(${rng('D')},B${r})`, mine.length);
    row.getCell(4).value = fx(`C${r}/$C$${MIX_TOTAL}`, total ? mine.length / total : 0);
    row.getCell(5).value = d === 'Not set'
      ? fx(`SUM(${rng('K')})-SUMIF(${rng('D')},"?*",${rng('K')})`, cost)
      : fx(`SUMIF(${rng('D')},B${r},${rng('K')})`, cost);
    row.getCell(6).value = fx(`IF(C${r}=0,0,E${r}/C${r})`, mine.length ? cost / mine.length : 0);
    for (let n = 1; n <= 6; n++) body(row.getCell(n), n === 2 ? 'left' : 'center', { fmt: n === 4 ? '0.0%' : n >= 5 ? '#,##0' : undefined });
  });
  const tr3 = ws3.getRow(MIX_TOTAL);
  tr3.height = 15;
  tr3.getCell(2).value = 'TOTAL';
  tr3.getCell(3).value = fx(`SUM(C5:C${MIX_TOTAL - 1})`, total);
  tr3.getCell(4).value = fx(`SUM(D5:D${MIX_TOTAL - 1})`, total ? 1 : 0);
  tr3.getCell(5).value = fx(`SUM(E5:E${MIX_TOTAL - 1})`, totalCost);
  tr3.getCell(6).value = fx(`E${MIX_TOTAL}/C${MIX_TOTAL}`, total ? totalCost / total : 0);
  for (let n = 1; n <= 6; n++) body(tr3.getCell(n), n === 2 ? 'left' : 'center', { bold: true, fill: GREY_FILL, fmt: n === 4 ? '0.0%' : n >= 5 ? '#,##0' : undefined });
  const chk3 = ws3.getRow(MIX_TOTAL + 1);
  chk3.getCell(2).value = 'Check: vs staff list (should be 0)';
  chk3.getCell(3).value = fx(`C${MIX_TOTAL}-COUNTA(${rng('C')})`, 0);
  checkStyle(chk3.getCell(2));
  checkStyle(chk3.getCell(3));

  // ============================================================ 4 and 5. Staff by Client / Staff Detail by Client
  type Cols = { headers: string[]; widths: number[]; cols: number };
  const groupSheet = (
    ws: Worksheet,
    spec: Cols,
    cellsFor: (p: Person, row: number, rowObj: Row) => void,
    styleFor: (n: number, bold?: boolean) => { align: Align; fmt?: string; color?: string },
    sumCols: { letter: string; index: number }[],
    heightFor: (p: Person) => number,
    checkLabelCol: number,
    checkCol: { letter: string; index: number },
    checkPrefix: string
  ) => {
    colWidth(ws, spec.widths);
    headerRow(ws, 4, spec.headers, 31.5);
    let r = 5;
    const subtotalRows: number[] = [];
    clients.forEach(c => {
      const members = grouped.filter(p => p.primary.label === c.label);
      if (members.length === 0) return;
      const first = r;
      members.forEach((p, i) => {
        const rowObj = ws.getRow(r);
        rowObj.height = heightFor(p);
        rowObj.getCell(2).value = i + 1;
        cellsFor(p, r, rowObj);
        for (let n = 1; n <= spec.cols; n++) {
          const s = styleFor(n);
          body(rowObj.getCell(n), s.align, { fmt: s.fmt, color: s.color, vertical: n === 1 ? 'top' : 'middle' });
        }
        r++;
      });
      const sub = ws.getRow(r);
      sub.height = 15;
      sub.getCell(3).value = `Subtotal (${members.length} staff)`;
      sumCols.forEach(sc => {
        sub.getCell(sc.index).value = fx(`SUBTOTAL(9,${sc.letter}${first}:${sc.letter}${r - 1})`, subtotalValue(members, sc.letter));
      });
      for (let n = 1; n <= spec.cols; n++) {
        const s = styleFor(n);
        body(sub.getCell(n), n === 3 ? 'left' : s.align, { bold: true, fill: SUB_FILL, fmt: s.fmt, vertical: n === 1 ? 'top' : 'middle' });
      }
      ws.mergeCells(first, 1, r, 1);
      const a = ws.getCell(first, 1);
      a.value = c.label;
      body(a, 'left', { bold: true, vertical: 'top' });
      a.alignment = { horizontal: 'left', vertical: 'top', wrapText: true };
      subtotalRows.push(r);
      r++;
    });
    const grand = ws.getRow(r);
    grand.height = 15;
    grand.getCell(3).value = 'GRAND TOTAL';
    sumCols.forEach(sc => {
      grand.getCell(sc.index).value = fx(`SUBTOTAL(9,${sc.letter}5:${sc.letter}${r - 1})`, subtotalValue(list, sc.letter));
    });
    for (let n = 1; n <= spec.cols; n++) {
      const s = styleFor(n);
      body(grand.getCell(n), n === 3 ? 'left' : s.align, { bold: true, fill: GREY_FILL, fmt: s.fmt, vertical: n === 1 ? 'top' : 'middle' });
    }
    const chk = ws.getRow(r + 1);
    chk.getCell(checkLabelCol).value = checkPrefix;
    chk.getCell(checkCol.index).value = fx(`${checkCol.letter}${r}-SUM(${rng('K')})`, 0);
    checkStyle(chk.getCell(checkLabelCol));
    checkStyle(chk.getCell(checkCol.index));
    ws.pageSetup.printTitlesRow = '4:4';
    return r + 3;
  };

  const salaryOf = (p: Person) => Number(p.salary) || 0;
  const conveyanceOf = (p: Person) => Number(p.conveyance) || 0;
  const subtotalValue = (members: Person[], letter: string): number => {
    const s = (fn: (p: Person) => number) => members.reduce((a, p) => a + fn(p), 0);
    if (letter === 'F' || letter === 'M') return s(money);
    if (letter === 'K') return s(salaryOf);
    if (letter === 'L') return s(conveyanceOf);
    return 0;
  };

  // ---- 4. Staff by Client
  const ws4 = sheetBase('Staff by Client', 'Staff by Client', subtitle, { x: 1, y: 4 }, 'FF2E75B6');
  groupSheet(
    ws4,
    { headers: ['Client', 'SL', 'Name', 'Designation', 'Secondary Client(s)', 'Monthly Cost (BDT)'], widths: [36, 5, 30, 24, 58, 14], cols: 6 },
    (p, _r, row) => {
      row.getCell(3).value = p.name;
      row.getCell(4).value = p.designation || '-';
      row.getCell(5).value = secText(p);
      row.getCell(6).value = fx(`${SHEET}!K${listRowOf.get(p)}`, money(p));
    },
    n => ({ align: n === 2 || n === 6 ? 'center' : 'left', fmt: n === 6 ? '#,##0' : undefined }),
    [{ letter: 'F', index: 6 }],
    p => Math.max(15, lineCount(secText(p), 58) * 13),
    3,
    { letter: 'F', index: 6 },
    'Check: grand total vs staff list (should be 0)'
  );

  // ---- 5. Staff Detail by Client
  const ws5 = sheetBase('Staff Detail by Client', 'Staff Detail by Client', `${subtitle}  |  Amounts in BDT per month`, { x: 3, y: 4 }, 'FF2E75B6');
  const dash = (v?: string | null) => (v && String(v).trim() ? String(v).trim() : '-');
  const yearOf = (p: Person): string => {
    const st = p.st;
    const y = st
      ? isEmployeeId(p.empId)
        ? employmentYearFromJoining(st.joiningDate)
        : academicYearFromStart(st.articleshipStart, st.articleshipEnd)
      : '';
    return y || (p.academicYear && p.academicYear !== '—' ? p.academicYear : '-');
  };
  const detailWidths = [30, 5, 26, 22, 12, 40, 24, 11, 11, 30, 12, 11, 12, 13, 32, 34];
  const noteAt5 = groupSheet(
    ws5,
    {
      headers: ['Client', 'SL', 'Name', 'Designation', 'Academic / Employment Year', 'Secondary Client(s)', 'Articleship Period', 'Articleship Start', 'Articleship End', 'Principal', 'Monthly Allowance / Salary', 'Conveyance', 'Total Cost', 'Mobile', 'Email', 'Remarks'],
      widths: detailWidths,
      cols: 16
    },
    (p, r, row) => {
      const emp = isEmployeeId(p.empId);
      const remarks = [p.remarks, p.st?.remarks].filter(Boolean).join(' | ');
      row.getCell(3).value = p.name;
      row.getCell(4).value = p.designation || '-';
      row.getCell(5).value = yearOf(p);
      row.getCell(6).value = secText(p);
      row.getCell(7).value = emp ? '-' : dash(p.st?.articleshipPeriod);
      row.getCell(8).value = (!emp && toDate(p.st?.articleshipStart)) || '-';
      row.getCell(9).value = (!emp && toDate(p.st?.articleshipEnd)) || '-';
      row.getCell(10).value = emp ? '-' : dash(principalDisplay(p.st?.principalName));
      row.getCell(11).value = fx(`${SHEET}!I${listRowOf.get(p)}`, salaryOf(p));
      row.getCell(12).value = fx(`${SHEET}!J${listRowOf.get(p)}`, conveyanceOf(p));
      row.getCell(13).value = fx(`K${r}+L${r}`, money(p));
      row.getCell(14).value = dash(p.mobile || p.st?.mobile);
      row.getCell(15).value = dash(p.email || p.st?.email);
      row.getCell(16).value = dash(remarks);
    },
    n =>
      n === 2 || n === 8 || n === 9
        ? { align: 'center', fmt: n === 8 || n === 9 ? 'dd-mmm-yy' : undefined }
        : n >= 11 && n <= 13
          ? { align: 'center', fmt: '#,##0', color: n === 11 || n === 12 ? 'FF008000' : undefined }
          : n === 14
            ? { align: 'left', fmt: '@' }
            : { align: 'left' },
    [{ letter: 'K', index: 11 }, { letter: 'L', index: 12 }, { letter: 'M', index: 13 }],
    p => Math.max(15, Math.max(lineCount(secText(p), 40), lineCount([p.remarks, p.st?.remarks].filter(Boolean).join(' | '), 34), lineCount(p.name, 26)) * 13),
    3,
    { letter: 'M', index: 13 },
    'Check: total cost vs staff list (should be 0)'
  );
  // Amber when an articleship ends within 90 days
  ws5.addConditionalFormatting({
    ref: `I5:I${noteAt5 - 3}`,
    rules: [{ type: 'expression', formulae: ['AND(ISNUMBER(I5),I5<=TODAY()+90)'], priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: AMBER } } } }]
  });
  noteRow(ws5, noteAt5, 16, 'Amber = articleship ends within the next 90 days. Salary and conveyance are linked from the Staff List sheet (green).');

  // ============================================================ 6. Staff List (the data the other sheets read)
  const ws6 = sheetBase('Staff List', 'Staff List', `Source: ACNABIN Task Tracker, Manpower tab. Amounts in BDT per month.`, { x: 3, y: 4 }, 'FF7F7F7F');
  colWidth(ws6, [5, 12, 30, 24, 20, 38, 10, 46, 12, 11, 12]);
  headerRow(ws6, 4, ['SL', 'Staff ID', 'Name', 'Designation', 'Department', 'Primary Client', 'Client Code', 'Secondary Client(s)', 'Salary / Allowance', 'Conveyance', 'Total Cost'], 35);
  staffListOrder.forEach((p, i) => {
    const r = LIST_FIRST + i;
    const row = ws6.getRow(r);
    row.height = Math.max(15, Math.max(lineCount(p.primary.label, 38), lineCount(secText(p), 46)) * 13);
    row.getCell(1).value = i + 1;
    row.getCell(2).value = p.empId;
    row.getCell(3).value = p.name;
    row.getCell(4).value = p.designation || '-';
    row.getCell(5).value = dash(p.st?.department);
    row.getCell(6).value = p.primary.label;
    row.getCell(7).value = p.primary.code;
    row.getCell(8).value = secText(p);
    row.getCell(9).value = salaryOf(p);
    row.getCell(10).value = conveyanceOf(p);
    row.getCell(11).value = fx(`I${r}+J${r}`, money(p));
    for (let n = 1; n <= 11; n++) body(row.getCell(n), n === 1 || n === 2 || n === 7 ? 'center' : n >= 9 ? 'center' : 'left', { fmt: n >= 9 ? '#,##0' : undefined });
  });
  const tr6 = ws6.getRow(LIST_LAST + 1);
  tr6.height = 15;
  tr6.getCell(3).value = 'TOTAL';
  tr6.getCell(9).value = fx(`SUM(I${LIST_FIRST}:I${LIST_LAST})`, list.reduce((a, p) => a + salaryOf(p), 0));
  tr6.getCell(10).value = fx(`SUM(J${LIST_FIRST}:J${LIST_LAST})`, list.reduce((a, p) => a + conveyanceOf(p), 0));
  tr6.getCell(11).value = fx(`SUM(K${LIST_FIRST}:K${LIST_LAST})`, totalCost);
  for (let n = 1; n <= 11; n++) body(tr6.getCell(n), n === 3 ? 'left' : 'center', { bold: true, fill: GREY_FILL, fmt: n >= 9 ? '#,##0' : undefined });
  ws6.autoFilter = { from: { row: 4, column: 1 }, to: { row: LIST_LAST, column: 11 } };
  ws6.pageSetup.printTitlesRow = '4:4';

  // ============================================================ 7. Notes
  const ws7 = wb.addWorksheet('Notes', { views: [{ showGridLines: false }] });
  ws7.getColumn(1).width = 120;
  ws7.getCell('A1').value = 'Basis of Preparation';
  ws7.getCell('A1').font = { name: FONT, size: 14, bold: true, color: { argb: NAVY } };
  ws7.getCell('A2').value = subtitle;
  ws7.getCell('A2').font = { name: FONT, size: 9, italic: true, color: { argb: 'FF595959' } };
  const merged = MERGED_CLIENT_GROUPS.map(g => g.join(' and ')).join('; ');
  [
    `1. Source: ACNABIN Task Tracker, Manpower tab (${total} staff).`,
    '2. Client codes are kept in a separate column so the client names stay clean.',
    '3. Each staff member is counted once, under their primary client. Leadership is assigned to "All Clients".',
    '4. Secondary coverage counts staff whose secondary assignment names the client; these staff are already counted under their own primary client.',
    '5. Monthly cost = salary/allowance + conveyance, in BDT.',
    `6. ${merged} ${MERGED_CLIENT_GROUPS.length === 1 ? 'are' : 'are each'} treated as one client: their staff and cost are counted together and shown on two lines.`,
    '7. Supervisors are counted with In Charge, and Partners and Managers with Leadership and Managers, in the summary columns.'
  ].forEach((t, i) => {
    const c = ws7.getCell(4 + i, 1);
    c.value = t;
    c.font = { name: FONT, size: 10 };
    c.alignment = { wrapText: true, vertical: 'top' };
  });
  ws7.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function downloadManpowerWorkbook(
  people: ExportPerson[],
  clientOrder: ExportClient[],
  staff: MyStaff[],
  fileName: string
): Promise<void> {
  const buf = await buildManpowerWorkbook(people, clientOrder, staff);
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
