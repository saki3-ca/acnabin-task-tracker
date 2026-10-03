// Styled Excel file of the invoice list (same look as the Proposals and Manpower downloads).
import { Invoice } from '../types';
import { toNum } from './invoices';

const BLUE = 'FF2F5D8E';
const BAND = 'FFF3F6FB';
const LINE = { style: 'thin' as const, color: { argb: 'FFB8C4D4' } };
const BORDER = { top: LINE, left: LINE, bottom: LINE, right: LINE };

const toDate = (iso?: string): Date | null => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

type Col = { h: string; w: number; a: 'left' | 'center' | 'right'; kind?: 'date' | 'money' | 'link'; get: (i: Invoice, n: number) => string | number | Date | null };
const t = (v: string) => v || null;

const COLS: Col[] = [
  { h: 'SL', w: 6, a: 'center', get: (_i, n) => n },
  { h: 'For the month', w: 16, a: 'center', get: i => t(i.forMonth) },
  { h: 'Year', w: 8, a: 'center', get: i => (i.year ? Number(i.year) : null) },
  { h: 'Invoice Date', w: 14, a: 'center', kind: 'date', get: i => toDate(i.invoiceDate) },
  { h: 'Client Name', w: 36, a: 'left', get: i => t(i.client) },
  { h: 'JIC Name', w: 24, a: 'left', get: i => t(i.jicName) },
  { h: 'Job Number', w: 12, a: 'center', get: i => t(i.jobNumber) },
  { h: 'Purpose', w: 24, a: 'left', get: i => t(i.purpose) },
  { h: 'Invoice Number', w: 22, a: 'center', get: i => t(i.invoiceNo) },
  { h: 'Submission Number', w: 13, a: 'center', get: i => t(i.submissionNo) },
  { h: 'Invoice Amount (Including VAT & TAX)', w: 18, a: 'right', kind: 'money', get: i => (i.amount ? toNum(i.amount) : null) },
  { h: 'TDS', w: 13, a: 'right', kind: 'money', get: i => (i.tds ? toNum(i.tds) : null) },
  { h: 'VDS', w: 13, a: 'right', kind: 'money', get: i => (i.vds ? toNum(i.vds) : null) },
  { h: 'Signed invoice submitted to ACNABIN', w: 16, a: 'center', get: i => t(i.signedSubmitted) },
  { h: 'Mail Date', w: 14, a: 'center', kind: 'date', get: i => toDate(i.mailDate) },
  { h: 'Collection Status', w: 13, a: 'center', get: i => t(i.collected) },
  { h: 'Collection Date', w: 14, a: 'center', kind: 'date', get: i => toDate(i.collectionDate) },
  { h: 'Collection Method', w: 14, a: 'center', get: i => t(i.collectionMethod) },
  { h: 'Cheque number / Transaction reference', w: 26, a: 'center', get: i => t(i.paymentRef) },
  { h: 'VDS Collection Status', w: 13, a: 'center', get: i => t(i.vdsCollected) },
  { h: 'VDS Collection Date', w: 14, a: 'center', kind: 'date', get: i => toDate(i.vdsDate) },
  { h: 'VDS Challan Copy', w: 26, a: 'left', kind: 'link', get: i => t(i.vdsChallanLink) },
  { h: 'VDS Challan Number', w: 20, a: 'center', get: i => t(i.vdsChallanNo) },
  { h: 'TDS Collection Status', w: 13, a: 'center', get: i => t(i.tdsCollected) },
  { h: 'TDS Collection Date', w: 14, a: 'center', kind: 'date', get: i => toDate(i.tdsDate) },
  { h: 'TDS Challan Copy', w: 26, a: 'left', kind: 'link', get: i => t(i.tdsChallanLink) },
  { h: 'TDS Challan Number', w: 20, a: 'center', get: i => t(i.tdsChallanNo) },
  { h: 'Remarks', w: 40, a: 'left', get: i => t(i.remarks) },
  { h: 'ERP entry completed and reviewed with Director', w: 30, a: 'left', get: i => t(i.erpNote) }
];

// Group bands above the headers: [first column, last column, label] (1-based)
const BANDS: [number, number, string][] = [[11, 13, 'Amount'], [16, 19, 'Collection Status'], [20, 23, 'VDS Collection Status'], [24, 27, 'TDS Collection Status']];

export async function downloadInvoicesExcel(rows: Invoice[], fileName: string): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ACNABIN Task Tracker';
  const ws = wb.addWorksheet('Invoices', { views: [{ state: 'frozen', ySplit: 5, xSplit: 5, showGridLines: false }] });
  const n = COLS.length;

  ws.mergeCells(1, 1, 1, n);
  const title = ws.getCell(1, 1);
  title.value = 'Invoice Tracker';
  title.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF1B2A6B' } };
  title.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws.getRow(1).height = 34;
  ws.mergeCells(2, 1, 2, n);
  const sub = ws.getCell(2, 1);
  sub.value = `ACNABIN Chartered Accountants  ·  Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  sub.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6B6B6B' } };
  sub.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws.addRow([]);

  // band row (row 4)
  const bandRow = ws.addRow(new Array(n).fill(null));
  bandRow.height = 22;
  BANDS.forEach(([a, b, label]) => {
    ws.mergeCells(4, a, 4, b);
    const c = ws.getCell(4, a);
    c.value = label;
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1B2A6B' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F4' } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    for (let col = a; col <= b; col++) ws.getCell(4, col).border = BORDER;
  });

  const head = ws.addRow(COLS.map(c => c.h));
  head.height = 48;
  head.eachCell(c => {
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = BORDER;
  });
  COLS.forEach((c, i) => (ws.getColumn(i + 1).width = c.w));

  rows.forEach((inv, idx) => {
    const r = ws.addRow(COLS.map(c => c.get(inv, idx + 1)));
    r.eachCell({ includeEmpty: true }, (cell, col) => {
      const def = COLS[col - 1];
      if (!def) return;
      cell.font = { name: 'Calibri', size: 11 };
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', horizontal: def.a, wrapText: def.a === 'left', indent: def.a === 'left' ? 1 : 0 };
      if (def.kind === 'date') cell.numFmt = 'dd-mmm-yyyy';
      if (def.kind === 'money') cell.numFmt = '#,##0';
      if (def.kind === 'link' && typeof cell.value === 'string' && /^https?:\/\//i.test(cell.value)) {
        cell.value = { text: 'Open', hyperlink: cell.value };
        cell.font = { name: 'Calibri', size: 11, color: { argb: 'FF1D4ED8' }, underline: true };
      }
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
    });
  });

  // Totals under the table
  const total = ws.addRow(COLS.map((_c, i) => (i === 4 ? 'TOTAL' : null)));
  [11, 12, 13].forEach(col => {
    const letter = ws.getColumn(col).letter;
    total.getCell(col).value = { formula: `SUM(${letter}6:${letter}${5 + rows.length})`, result: rows.reduce((s, r) => s + toNum([r.amount, r.tds, r.vds][col - 11]), 0) };
    total.getCell(col).numFmt = '#,##0';
  });
  total.eachCell({ includeEmpty: true }, c => {
    c.font = { name: 'Calibri', size: 11, bold: true };
    c.border = BORDER;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F4' } };
  });

  ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: n } };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '4:5' };

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
