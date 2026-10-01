// Styled Excel file of the proposal list (same look as the Manpower download).
import { Proposal } from '../types';

const BLUE = 'FF2F5D8E';
const BAND = 'FFF3F6FB';
const LINE = { style: 'thin' as const, color: { argb: 'FFB8C4D4' } };
const BORDER = { top: LINE, left: LINE, bottom: LINE, right: LINE };

const toDate = (iso?: string): Date | null => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function downloadProposalsExcel(
  rows: { p: Proposal; files: number; daysLeft: number | null }[],
  fileName: string
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ACNABIN Task Tracker';
  const ws = wb.addWorksheet('Proposals', { views: [{ state: 'frozen', ySplit: 4, showGridLines: false }] });

  const cols = [
    { h: 'SL', w: 6, a: 'center' }, { h: 'Proposal', w: 52, a: 'left' }, { h: 'Client', w: 34, a: 'left' }, { h: 'Type', w: 18, a: 'center' },
    { h: 'Receive Date', w: 14, a: 'center' }, { h: 'Deadline', w: 14, a: 'center' }, { h: 'Days Left', w: 10, a: 'center' },
    { h: 'Assigned To', w: 28, a: 'left' }, { h: 'Status', w: 20, a: 'center' }, { h: 'Attachments', w: 13, a: 'center' }, { h: 'Remarks', w: 50, a: 'left' }
  ] as const;

  ws.mergeCells(1, 1, 1, cols.length);
  const t = ws.getCell(1, 1);
  t.value = 'Proposal Tracker';
  t.font = { name: 'Calibri', size: 18, bold: true, color: { argb: 'FF1B2A6B' } };
  t.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(1).height = 34;
  ws.mergeCells(2, 1, 2, cols.length);
  const g = ws.getCell(2, 1);
  g.value = `ACNABIN Chartered Accountants  ·  Generated ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`;
  g.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF6B6B6B' } };
  g.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.addRow([]);

  const head = ws.addRow(cols.map(c => c.h));
  head.height = 30;
  head.eachCell(c => {
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = BORDER;
  });
  cols.forEach((c, i) => (ws.getColumn(i + 1).width = c.w));

  rows.forEach(({ p, files, daysLeft }, i) => {
    const r = ws.addRow([i + 1, p.name, p.client, p.type || null, toDate(p.receiveDate), toDate(p.deadline), daysLeft, p.assignedTo || null, p.status, files || null, p.remarks || null]);
    r.eachCell({ includeEmpty: true }, (c, n) => {
      const col = cols[n - 1];
      if (!col) return;
      c.font = { name: 'Calibri', size: 11 };
      c.border = BORDER;
      c.alignment = { vertical: 'middle', horizontal: col.a, wrapText: col.a === 'left', indent: col.a === 'left' ? 1 : 0 };
      if (n === 5 || n === 6) c.numFmt = 'dd-mmm-yyyy';
      if (i % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BAND } };
    });
  });

  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: cols.length } };
  ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: '4:4' };

  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
