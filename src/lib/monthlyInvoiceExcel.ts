import { Invoice } from '../types';
import { MONTHS, toNum } from './invoices';

const toDate = (iso?: string): Date | null => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

const getLastDayOfMonth = (year: number, monthIndex: number): number => {
  const d = new Date(year, monthIndex + 1, 0);
  return d.getDate();
};

export interface MonthlyExcelOptions {
  month: string; // e.g. "September"
  year: string;  // e.g. "2026"
  partnerTitle?: string;
  partnerConcern?: string;
}

export async function downloadMonthlyInvoicesExcel(
  invoices: Invoice[],
  options: MonthlyExcelOptions
): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ACNABIN ERP';

  const monthName = options.month;
  const monthIdx = MONTHS.findIndex(m => m.toLowerCase() === monthName.toLowerCase());
  const yearNum = Number(options.year) || new Date().getFullYear();
  const safeMonthIdx = monthIdx >= 0 ? monthIdx : new Date().getMonth();
  const lastDay = getLastDayOfMonth(yearNum, safeMonthIdx);
  const mm = String(safeMonthIdx + 1).padStart(2, '0');

  // Exact title preset
  const partnerHeader = options.partnerTitle || 'Mr. Abdullah - Al - Mamun, FCA (ERP ID : EMP-000644)';
  const partnerConcern = options.partnerConcern || 'AH';

  // Fonts & styles: Tahoma 12 for titles, Tahoma 10 for headers and data
  const fontTitle = { name: 'Tahoma', size: 12, bold: true, color: { theme: 1 } };
  const fontSub = { name: 'Tahoma', size: 10, bold: false, color: { theme: 1 } };
  const fontHeader = { name: 'Tahoma', size: 10, bold: true, color: { theme: 1 } };
  const fontHeaderH6 = { name: 'Tahoma', size: 9, bold: true, color: { theme: 1 } };
  const fontData = { name: 'Tahoma', size: 10, color: { theme: 1 } };
  const fontTotal = { name: 'Tahoma', size: 10, bold: true, color: { theme: 1 } };

  const moneyFmt = '_(* #,##0_);_(* (#,##0);_(* "-"??_);_(@_)';
  const dateFmt = 'd-mmm-yy';
  const thinBorder = {
    top: { style: 'thin' as const, color: { argb: 'FF000000' } },
    left: { style: 'thin' as const, color: { argb: 'FF000000' } },
    bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
    right: { style: 'thin' as const, color: { argb: 'FF000000' } }
  };

  // =========================================================================
  // SHEET 1: Details of collection
  // =========================================================================
  // Freeze pane after Row 8 so titles, blank row, and table headers stay fixed on scroll
  const wsCol = wb.addWorksheet('Details of collection', {
    views: [{ state: 'frozen', ySplit: 8, xSplit: 0, showGridLines: false }]
  });

  // Explicit column widths
  const colWidths1 = [5.5, 32.5, 8.5, 16.5, 13.0, 16.5, 13.0, 25.56, 15.89, 13.5, 17.5, 16.0, 16.0, 16.5];
  wsCol.columns = colWidths1.map(w => ({ width: w }));
  colWidths1.forEach((w, i) => {
    wsCol.getColumn(i + 1).width = w;
  });

  // Row 1: single blank row from top
  wsCol.getRow(1).height = 15;

  // Title rows starting at Row 2
  wsCol.mergeCells('A2:N2');
  const t1 = wsCol.getCell('A2');
  t1.value = 'Details of professional fees collection';
  t1.font = fontTitle;
  t1.alignment = { horizontal: 'center', vertical: 'middle' };
  wsCol.getRow(2).height = 18;

  wsCol.mergeCells('A3:N3');
  const sub1 = wsCol.getCell('A3');
  sub1.value = `For the month of ${monthName}, ${yearNum}`;
  sub1.font = fontSub;
  sub1.alignment = { horizontal: 'center', vertical: 'middle' };
  wsCol.getRow(3).height = 18;

  wsCol.mergeCells('A4:N4');
  const part1 = wsCol.getCell('A4');
  part1.value = partnerHeader;
  part1.font = fontSub;
  part1.alignment = { horizontal: 'center', vertical: 'middle' };
  wsCol.getRow(4).height = 18;

  // Row 5: blank row after partner info with height 11
  wsCol.getRow(5).height = 11;

  // Header rows: Rows 6, 7, 8
  const r6 = wsCol.getRow(6);
  r6.getCell(1).value = 'Sl No.';
  r6.getCell(2).value = 'Clients name';
  r6.getCell(3).value = 'Job no';
  r6.getCell(4).value = 'Invoice no.';
  r6.getCell(5).value = 'Invoice date';
  r6.getCell(6).value = 'Invoice amount (Fee+VAT)';
  r6.getCell(7).value = 'VAT deducted at source';
  r6.getCell(8).value = 'VAT received with payment\n(i.e. if not deducted at source,\nif any)';
  r6.getCell(9).value = 'Revenue';
  r6.getCell(10).value = 'Income tax deducted by client';
  r6.getCell(11).value = 'Net amount paid by client';
  r6.getCell(12).value = 'Partner concern';
  r6.getCell(13).value = 'Entry date of collection in ERP';
  r6.getCell(14).value = 'Tick if collected from USAID financed project';

  const r7 = wsCol.getRow(7);
  r7.getCell(6).value = '(A)';
  r7.getCell(7).value = '(B)';
  r7.getCell(8).value = '(C)';
  r7.getCell(9).value = '(D)=(A)-(B)-(C)';
  r7.getCell(10).value = '(E)';
  r7.getCell(11).value = '(F)=(A)-(B)-(E)';

  const r8 = wsCol.getRow(8);
  r8.getCell(6).value = 'BDT';
  r8.getCell(7).value = 'BDT';
  r8.getCell(8).value = 'BDT';
  r8.getCell(9).value = 'BDT';
  r8.getCell(10).value = 'BDT';
  r8.getCell(11).value = 'BDT';

  ['A', 'B', 'C', 'D', 'E', 'L', 'M', 'N'].forEach(col => {
    wsCol.mergeCells(`${col}6:${col}8`);
  });

  for (let r = 6; r <= 8; r++) {
    const row = wsCol.getRow(r);
    row.height = r === 6 ? 40.1 : 20;
    for (let c = 1; c <= 14; c++) {
      const cell = row.getCell(c);
      cell.font = (r === 6 && c === 8) ? fontHeaderH6 : fontHeader;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = thinBorder;
    }
  }

  const targetYearMonth = `${yearNum}-${mm}`;
  const collectedRows = invoices.filter(inv => {
    if (inv.collectionDate && inv.collectionDate.startsWith(targetYearMonth)) return true;
    if (inv.collected === 'Yes' && (!inv.collectionDate || !/^\d{4}-\d{2}/.test(inv.collectionDate))) {
      return inv.forMonth?.toLowerCase() === monthName.toLowerCase() && String(inv.year) === String(yearNum);
    }
    return false;
  });

  let curRow = 9;
  collectedRows.forEach((inv, idx) => {
    const amt = toNum(inv.amount);
    const vds = toNum(inv.vds);
    const vatRec = 0;
    const rev = amt - vds - vatRec;
    const tds = toNum(inv.tds);
    const net = amt - vds - tds;

    const row = wsCol.getRow(curRow);
    row.height = 19;

    row.getCell(1).value = idx + 1;
    row.getCell(1).font = fontData;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(2).value = inv.client || '';
    row.getCell(2).font = fontData;
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    row.getCell(3).value = inv.jobNumber || '';
    row.getCell(3).font = fontData;
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(4).value = inv.invoiceNo || '';
    row.getCell(4).font = fontData;
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(5).value = toDate(inv.invoiceDate);
    row.getCell(5).font = fontData;
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).numFmt = dateFmt;

    row.getCell(6).value = amt;
    row.getCell(6).font = fontData;
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(6).numFmt = moneyFmt;

    row.getCell(7).value = vds || null;
    row.getCell(7).font = fontData;
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(7).numFmt = moneyFmt;

    row.getCell(8).value = null;
    row.getCell(8).font = fontData;
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(8).numFmt = moneyFmt;

    row.getCell(9).value = rev;
    row.getCell(9).font = fontData;
    row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(9).numFmt = moneyFmt;

    row.getCell(10).value = tds || null;
    row.getCell(10).font = fontData;
    row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(10).numFmt = moneyFmt;

    row.getCell(11).value = net;
    row.getCell(11).font = fontData;
    row.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(11).numFmt = moneyFmt;

    row.getCell(12).value = partnerConcern;
    row.getCell(12).font = fontData;
    row.getCell(12).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(13).value = toDate(inv.collectionDate);
    row.getCell(13).font = fontData;
    row.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(13).numFmt = dateFmt;

    row.getCell(14).value = null;

    for (let c = 1; c <= 14; c++) {
      row.getCell(c).border = thinBorder;
    }
    curRow++;
  });

  const lastDataRowCol = Math.max(9, curRow - 1);
  const totalRowCol = curRow;
  const tot1 = wsCol.getRow(totalRowCol);
  tot1.height = 20;

  tot1.getCell(1).value = '.';
  tot1.getCell(1).font = fontTotal;
  tot1.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  tot1.getCell(2).value = '.';
  tot1.getCell(2).font = fontTotal;
  tot1.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

  [6, 7, 8, 9, 10, 11].forEach(colIdx => {
    const colLetter = wsCol.getColumn(colIdx).letter;
    tot1.getCell(colIdx).value = {
      formula: `SUM(${colLetter}9:${colLetter}${lastDataRowCol})`
    };
    tot1.getCell(colIdx).font = fontTotal;
    tot1.getCell(colIdx).alignment = { horizontal: 'right', vertical: 'middle' };
    tot1.getCell(colIdx).numFmt = moneyFmt;
  });

  for (let c = 1; c <= 14; c++) {
    tot1.getCell(c).border = thinBorder;
  }

  // Lock column widths for Sheet 1
  colWidths1.forEach((w, i) => {
    wsCol.getColumn(i + 1).width = w;
  });

  // =========================================================================
  // SHEET 2: Details of invoicing
  // =========================================================================
  // Freeze pane after Row 6 so titles, blank row, and table header stay fixed on scroll
  const wsInv = wb.addWorksheet('Details of invoicing', {
    views: [{ state: 'frozen', ySplit: 6, xSplit: 0, showGridLines: false }]
  });

  const colWidths2 = [5.5, 28.0, 8.5, 16.80, 14.0, 12.5, 13.5, 12.0, 17.5, 16.0, 16.5];
  wsInv.columns = colWidths2.map(w => ({ width: w }));
  colWidths2.forEach((w, i) => {
    wsInv.getColumn(i + 1).width = w;
  });

  // Row 1: single blank row from top
  wsInv.getRow(1).height = 15;

  // Title rows starting at Row 2
  wsInv.mergeCells('A2:K2');
  const t2 = wsInv.getCell('A2');
  t2.value = 'Details of invoicing';
  t2.font = fontTitle;
  t2.alignment = { horizontal: 'center', vertical: 'middle' };
  wsInv.getRow(2).height = 18;

  wsInv.mergeCells('A3:K3');
  const sub2 = wsInv.getCell('A3');
  sub2.value = `For the month of ${monthName} ${yearNum}`;
  sub2.font = fontSub;
  sub2.alignment = { horizontal: 'center', vertical: 'middle' };
  wsInv.getRow(3).height = 18;

  wsInv.mergeCells('A4:K4');
  const part2 = wsInv.getCell('A4');
  part2.value = partnerHeader;
  part2.font = fontSub;
  part2.alignment = { horizontal: 'center', vertical: 'middle' };
  wsInv.getRow(4).height = 18;

  // Row 5: blank row after partner info with height 11
  wsInv.getRow(5).height = 11;

  const hInv = [
    'Sl No.', 'Clients name', 'Job no.', 'Invoice no. generated by ERP',
    'Control number taken from admin', 'Invoice date', 'Fee ', 'VAT',
    'Invoiced amount (Fee+VAT)', 'Partner concern', 'Tick if raised to USAID financed project'
  ];
  const rInv = wsInv.getRow(6);
  rInv.height = 40.1;
  hInv.forEach((val, idx) => {
    const cell = rInv.getCell(idx + 1);
    cell.value = val;
    cell.font = fontHeader;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  });

  const invoicedRows = invoices.filter(inv => {
    if (inv.forMonth?.toLowerCase() === monthName.toLowerCase() && String(inv.year) === String(yearNum)) {
      return true;
    }
    if (inv.invoiceDate && inv.invoiceDate.startsWith(targetYearMonth)) {
      return true;
    }
    return false;
  });

  let curInvRow = 7;
  invoicedRows.forEach((inv, idx) => {
    const amt = toNum(inv.amount);
    const vds = toNum(inv.vds);
    const fee = vds > 0 ? amt - vds : Math.round(amt / 1.15);
    const vat = vds > 0 ? vds : (amt - fee);
    const controlNo = inv.submissionNo ? (Number(inv.submissionNo) || inv.submissionNo) : null;

    const row = wsInv.getRow(curInvRow);
    row.height = 19;

    row.getCell(1).value = idx + 1;
    row.getCell(1).font = fontData;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(2).value = inv.client || '';
    row.getCell(2).font = fontData;
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

    row.getCell(3).value = inv.jobNumber || '';
    row.getCell(3).font = fontData;
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(4).value = inv.invoiceNo || '';
    row.getCell(4).font = fontData;
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(5).value = controlNo;
    row.getCell(5).font = fontData;
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(6).value = toDate(inv.invoiceDate);
    row.getCell(6).font = fontData;
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).numFmt = dateFmt;

    row.getCell(7).value = fee;
    row.getCell(7).font = fontData;
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(7).numFmt = moneyFmt;

    row.getCell(8).value = vat;
    row.getCell(8).font = fontData;
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(8).numFmt = moneyFmt;

    row.getCell(9).value = amt;
    row.getCell(9).font = fontData;
    row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(9).numFmt = moneyFmt;

    row.getCell(10).value = partnerConcern;
    row.getCell(10).font = fontData;
    row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(11).value = null;

    for (let c = 1; c <= 11; c++) {
      row.getCell(c).border = thinBorder;
    }
    curInvRow++;
  });

  const lastDataRowInv = Math.max(7, curInvRow - 1);
  const totalRowInv = curInvRow;
  const tot2 = wsInv.getRow(totalRowInv);
  tot2.height = 20;

  tot2.getCell(1).value = '.';
  tot2.getCell(1).font = fontTotal;
  tot2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

  tot2.getCell(2).value = '.';
  tot2.getCell(2).font = fontTotal;
  tot2.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };

  [7, 8, 9].forEach(colIdx => {
    const colLetter = wsInv.getColumn(colIdx).letter;
    tot2.getCell(colIdx).value = {
      formula: `SUM(${colLetter}7:${colLetter}${lastDataRowInv})`
    };
    tot2.getCell(colIdx).font = fontTotal;
    tot2.getCell(colIdx).alignment = { horizontal: 'right', vertical: 'middle' };
    tot2.getCell(colIdx).numFmt = moneyFmt;
  });

  for (let c = 1; c <= 11; c++) {
    tot2.getCell(c).border = thinBorder;
  }

  // Lock column widths for Sheet 2
  colWidths2.forEach((w, i) => {
    wsInv.getColumn(i + 1).width = w;
  });

  const filename = `Final Invoices information as on ${lastDay}.${mm}.${yearNum} (${monthName}-${yearNum}).xlsx`;
  const buf = await wb.xlsx.writeBuffer();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    })
  );
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
