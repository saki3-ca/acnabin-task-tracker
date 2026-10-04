// Excel download for the Manpower tab of a below-AD user: the same columns as the table, no money.
import { principalDisplay } from './academicYear';

export const SCOPED_EXCEL_HEADERS = [
  'SL', 'STD/EMP ID', 'Name', 'Designation', 'Department', 'Client Name(s)', 'Academic / Employment Year', 'Joining Date',
  'Articleship Period', 'Articleship Start', 'Articleship End', 'Principal', 'Mobile', 'Email', 'Blood Group', 'Present Address',
  'Emergency Contact Name', 'Relationship', 'Emergency Mobile', 'Laptop Available', 'Laptop Ownership', 'Laptop ID', 'Remarks'
];

export interface ScopedExcelLine {
  empId: string; name: string; designation: string; department: string; clients: string; year: string; joiningDate: string;
  articleshipPeriod: string; articleshipStart: string; articleshipEnd: string; principal: string; mobile: string; email: string;
  bloodGroup: string; presentAddress: string; emergencyName: string; relationship: string; emergencyPhone: string;
  laptopAvailable: string; laptopOwnership: string; laptopId: string; remarks: string;
}

export async function downloadScopedManpowerExcel(lines: ScopedExcelLine[], fileName: string): Promise<void> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'ACNABIN Task Tracker';
  const ws = wb.addWorksheet('Manpower', { views: [{ state: 'frozen', ySplit: 1, xSplit: 3 }] });
  const head = ws.addRow(SCOPED_EXCEL_HEADERS);
  head.height = 32;
  head.eachCell(c => {
    c.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800000' } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  lines.forEach((l, i) => {
    ws.addRow([
      i + 1, l.empId, l.name, l.designation, l.department, l.clients, l.year, l.joiningDate, l.articleshipPeriod,
      l.articleshipStart, l.articleshipEnd, principalDisplay(l.principal), l.mobile, l.email, l.bloodGroup, l.presentAddress,
      l.emergencyName, l.relationship, l.emergencyPhone, l.laptopAvailable, l.laptopOwnership, l.laptopId, l.remarks
    ]);
  });
  const widths = [6, 13, 26, 18, 16, 36, 18, 13, 16, 13, 13, 26, 14, 28, 9, 36, 22, 14, 14, 11, 13, 14, 30];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  // the period is on two lines: "29 Sep 2022 to" / "28 Sep 2026"
  ws.getColumn(9).alignment = { wrapText: true, vertical: 'middle' };
  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
