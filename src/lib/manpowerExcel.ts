// Builds the styled Manpower workbook (Client-wise Summary + All Manpower Information).
// exceljs is loaded only when someone downloads, so it does not slow the app down.
import { academicYearFromStart, employmentYearFromJoining, isEmployeeId, principalDisplay } from './academicYear';
import { MyStaff } from '../types';

export interface SummaryLine {
  clientName: string;
  manpower: number;
  salary: number;
  conveyance: number;
  total: number;
  remarks: string;
}

export interface DetailLine {
  empId: string;
  name: string;
  designation: string;
  clients: string;
  academicYear: string;
  salary: number;
  conveyance: number;
  total: number;
  mobile: string;
  email: string;
  remarks: string;
}

const BLUE = 'FF2F5D8E';
const BAND = 'FFF3F6FB';
const TOTAL_FILL = 'FFDCE6F1';
const LINE = { style: 'thin' as const, color: { argb: 'FFB8C4D4' } };
const BORDER = { top: LINE, left: LINE, bottom: LINE, right: LINE };
const FONT = 'Calibri';

const toDate = (iso?: string): Date | null => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function buildManpowerWorkbook(
  summary: SummaryLine[],
  grand: { manpower: number; salary: number; conveyance: number; total: number },
  details: DetailLine[],
  staff: MyStaff[]
): Promise<ArrayBuffer> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ACNABIN Task Tracker';
  wb.created = new Date();
  const generated = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const addTitle = (ws: import('exceljs').Worksheet, title: string, cols: number) => {
    ws.mergeCells(1, 1, 1, cols);
    const t = ws.getCell(1, 1);
    t.value = title;
    t.font = { name: FONT, size: 18, bold: true, color: { argb: 'FF1B2A6B' } };
    t.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(1).height = 34;
    ws.mergeCells(2, 1, 2, cols);
    const g = ws.getCell(2, 1);
    g.value = `ACNABIN Chartered Accountants  ·  Generated ${generated}`;
    g.font = { name: FONT, size: 10, italic: true, color: { argb: 'FF6B6B6B' } };
    g.alignment = { horizontal: 'center', vertical: 'middle' };
    ws.getRow(2).height = 18;
  };

  const styleHeader = (row: import('exceljs').Row) => {
    row.height = 32;
    row.eachCell(c => {
      c.font = { name: FONT, size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = BORDER;
    });
  };

  // ---------------------------------------------------------------- Sheet 1: summary
  const ws1 = wb.addWorksheet('Client-wise Summary', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });
  const sumHeaders = ['SL', 'Client Name', 'Manpower', 'Total Salary', 'Total Conveyance', 'Total Cost', 'Remarks'];
  addTitle(ws1, 'Client-wise Summary', sumHeaders.length);
  ws1.addRow([]);
  styleHeader(ws1.addRow(sumHeaders));
  [7, 44, 13, 17, 19, 17, 40].forEach((w, i) => (ws1.getColumn(i + 1).width = w));

  summary.forEach((s, i) => {
    const r = ws1.addRow([i + 1, s.clientName, s.manpower, s.salary, s.conveyance, s.total, s.remarks]);
    r.height = 22;
    r.eachCell((c, n) => {
      c.font = { name: FONT, size: 11, bold: n === 6 };
      c.border = BORDER;
      c.alignment = { vertical: 'middle', horizontal: n === 2 || n === 7 ? 'left' : n === 1 || n === 3 ? 'center' : 'right', wrapText: n === 2 || n === 7, indent: n === 2 || n === 7 ? 1 : 0 };
      if (n >= 4 && n <= 6) c.numFmt = '#,##0';
      if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
    });
  });
  const gt = ws1.addRow(['', 'GRAND TOTAL', grand.manpower, grand.salary, grand.conveyance, grand.total, '']);
  gt.height = 26;
  gt.eachCell((c, n) => {
    c.font = { name: FONT, size: 11.5, bold: true, color: { argb: 'FF1B2A6B' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
    c.border = BORDER;
    c.alignment = { vertical: 'middle', horizontal: n === 2 ? 'left' : n === 3 ? 'center' : 'right', indent: n === 2 ? 1 : 0 };
    if (n >= 4 && n <= 6) c.numFmt = '#,##0';
  });
  ws1.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: sumHeaders.length } };
  ws1.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '4:4' };

  // ---------------------------------------------------------------- Sheet 2: all manpower information
  const byId = new Map(staff.map(s => [s.empId, s]));
  const hasStaff = staff.length > 0;

  type Col = { header: string; width: number; align?: 'left' | 'center' | 'right'; money?: boolean; date?: boolean; wrap?: boolean };
  const cols: Col[] = [
    { header: 'SL', width: 6, align: 'center' },
    { header: 'STD/EMP ID', width: 14, align: 'center' },
    { header: 'Name', width: 28, align: 'left' },
    { header: 'Designation', width: 22, align: 'left' },
    ...(hasStaff ? [{ header: 'Department', width: 22, align: 'left' } as Col] : []),
    { header: 'Client Name(s)', width: 40, align: 'left', wrap: true },
    { header: 'Academic / Employment Year', width: 16, align: 'center' },
    ...(hasStaff
      ? ([
          { header: 'Joining Date', width: 14, align: 'center', date: true },
          { header: 'Articleship Period', width: 26, align: 'center' },
          { header: 'Articleship Start', width: 14, align: 'center', date: true },
          { header: 'Articleship End', width: 14, align: 'center', date: true },
          { header: 'Principal', width: 30, align: 'left' }
        ] as Col[])
      : []),
    { header: 'Monthly Allowance / Salary', width: 16, align: 'right', money: true },
    { header: 'Conveyance', width: 14, align: 'right', money: true },
    { header: 'Total Cost', width: 14, align: 'right', money: true },
    { header: 'Mobile', width: 15, align: 'center' },
    { header: 'Email', width: 32, align: 'left' },
    ...(hasStaff
      ? ([
          { header: 'Blood Group', width: 10, align: 'center' },
          { header: 'Present Address', width: 40, align: 'left', wrap: true },
          { header: 'Emergency Contact Name', width: 24, align: 'left' },
          { header: 'Relationship', width: 14, align: 'center' },
          { header: 'Emergency Mobile', width: 15, align: 'center' },
          { header: 'Laptop Available', width: 11, align: 'center' },
          { header: 'Laptop Ownership', width: 14, align: 'center' },
          { header: 'Laptop ID', width: 18, align: 'center' }
        ] as Col[])
      : []),
    { header: 'Remarks', width: 36, align: 'left', wrap: true }
  ];

  const ws2 = wb.addWorksheet('All Manpower Information', { views: [{ state: 'frozen', xSplit: 3, ySplit: 4, showGridLines: false }] });
  addTitle(ws2, 'All Manpower Information', cols.length);
  ws2.addRow([]);
  styleHeader(ws2.addRow(cols.map(c => c.header)));
  cols.forEach((c, i) => (ws2.getColumn(i + 1).width = c.width));

  const cell = (h: string, d: DetailLine, st: MyStaff | undefined, idx: number): string | number | Date | null => {
    const isEmp = isEmployeeId(d.empId);
    switch (h) {
      case 'SL': return idx + 1;
      case 'STD/EMP ID': return d.empId;
      case 'Name': return d.name;
      case 'Designation': return d.designation;
      case 'Department': return st?.department || null;
      case 'Client Name(s)': return d.clients || null;
      case 'Academic / Employment Year': {
        const y = st
          ? isEmp
            ? employmentYearFromJoining(st.joiningDate)
            : academicYearFromStart(st.articleshipStart, st.articleshipEnd)
          : '';
        return y || (d.academicYear && d.academicYear !== '—' ? d.academicYear : null);
      }
      case 'Joining Date': return toDate(st?.joiningDate);
      case 'Articleship Period': return isEmp ? null : st?.articleshipPeriod || null;
      case 'Articleship Start': return isEmp ? null : toDate(st?.articleshipStart);
      case 'Articleship End': return isEmp ? null : toDate(st?.articleshipEnd);
      case 'Principal': return isEmp ? null : principalDisplay(st?.principalName) || null;
      case 'Monthly Allowance / Salary': return d.salary;
      case 'Conveyance': return d.conveyance;
      case 'Total Cost': return d.total;
      case 'Mobile': return d.mobile || st?.mobile || null;
      case 'Email': return d.email || st?.email || null;
      case 'Blood Group': return st?.bloodGroup || null;
      case 'Present Address': return st?.presentAddress || null;
      case 'Emergency Contact Name': return st?.emergencyName || null;
      case 'Relationship': return st?.emergencyRelationship || null;
      case 'Emergency Mobile': return st?.emergencyPhone || null;
      case 'Laptop Available': return st?.laptopAvailable || null;
      case 'Laptop Ownership': return st?.laptopOwnership || null;
      case 'Laptop ID': return st?.laptopId || null;
      case 'Remarks': return [d.remarks, st?.remarks].filter(Boolean).join(' | ') || null;
      default: return null;
    }
  };

  details.forEach((d, i) => {
    const st = byId.get(d.empId.trim().toUpperCase());
    const r = ws2.addRow(cols.map(c => cell(c.header, d, st, i)));
    r.height = 22;
    r.eachCell({ includeEmpty: true }, (c, n) => {
      const col = cols[n - 1];
      if (!col) return;
      c.font = { name: FONT, size: 11, bold: col.header === 'Total Cost' };
      c.border = BORDER;
      c.alignment = { vertical: 'middle', horizontal: col.align || 'left', wrapText: Boolean(col.wrap), indent: col.align === 'left' ? 1 : 0 };
      if (col.money) c.numFmt = '#,##0';
      if (col.date) c.numFmt = 'dd-mmm-yyyy';
      if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
    });
  });

  // Totals
  const sum = (k: 'salary' | 'conveyance' | 'total') => details.reduce((a, d) => a + (Number(d[k]) || 0), 0);
  const totals = ws2.addRow(
    cols.map(c =>
      c.header === 'Name' ? 'TOTAL' :
      c.header === 'Monthly Allowance / Salary' ? sum('salary') :
      c.header === 'Conveyance' ? sum('conveyance') :
      c.header === 'Total Cost' ? sum('total') : null
    )
  );
  totals.height = 26;
  totals.eachCell({ includeEmpty: true }, (c, n) => {
    const col = cols[n - 1];
    if (!col) return;
    c.font = { name: FONT, size: 11.5, bold: true, color: { argb: 'FF1B2A6B' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
    c.border = BORDER;
    c.alignment = { vertical: 'middle', horizontal: col.money ? 'right' : 'left', indent: col.money ? 0 : 1 };
    if (col.money) c.numFmt = '#,##0';
  });

  ws2.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: cols.length } };
  ws2.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '4:4' };

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export async function downloadManpowerWorkbook(
  summary: SummaryLine[],
  grand: { manpower: number; salary: number; conveyance: number; total: number },
  details: DetailLine[],
  staff: MyStaff[],
  fileName: string
): Promise<void> {
  const buf = await buildManpowerWorkbook(summary, grand, details, staff);
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
