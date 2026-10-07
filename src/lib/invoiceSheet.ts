import { parseCsv } from './staffSheet';
import { DateOrder, detectDateOrder, parseProposalDate } from './proposals';
import { InvoiceImportRow } from '../types';
import { MONTHS } from './invoices';

const strip = (s: string) => s.replace(/[‎‏‪-‮]/g, '').trim();
const norm = (h: string) => strip(h).toLowerCase().replace(/[^a-z0-9]/g, '');

type Key = keyof InvoiceImportRow;
const DATE_KEYS: Key[] = ['invoiceDate', 'clientSubmitDate', 'mailDate', 'collectionDate', 'vdsDate', 'tdsDate'];
const MONEY_KEYS: Key[] = ['amount', 'tds', 'vds'];
const YESNO_KEYS: Key[] = ['clientSubmitted', 'signedSubmitted', 'collected', 'vdsCollected', 'tdsCollected'];

// Column names as in the Excel export (and the old sheet); matched ignoring capitals and symbols.
const HEADER_KEYS: Record<string, Key> = {
  forthemonth: 'forMonth', month: 'forMonth', formonth: 'forMonth',
  year: 'year',
  invoicedate: 'invoiceDate', invoicedateddmmyy: 'invoiceDate',
  clientname: 'client', client: 'client',
  jobincharge: 'jicName', jicname: 'jicName', jic: 'jicName',
  jobnumber: 'jobNumber', jobno: 'jobNumber',
  purpose: 'purpose',
  invoicenumber: 'invoiceNo', invoiceno: 'invoiceNo',
  submissionnumber: 'submissionNo', submissionno: 'submissionNo',
  invoiceamountincludingvattax: 'amount', invoiceamount: 'amount', amount: 'amount',
  tds: 'tds', vds: 'vds',
  submissionstatusclient: 'clientSubmitted',
  submissionstatusofsignedinvoicetoacnabin: 'signedSubmitted',
  submittedtoclient: 'clientSubmitted',
  clientsubmissiondate: 'clientSubmitDate',
  signedinvoicemailtoacnabin: 'mailDate',
  maildate: 'mailDate', maildateddmmyy: 'mailDate',
  collectionstatus: 'collected',
  collectiondate: 'collectionDate', collectiondateddmmyy: 'collectionDate',
  collectionmethod: 'collectionMethod',
  chequenumbertransactionreference: 'paymentRef', paymentref: 'paymentRef',
  vdscollectionstatus: 'vdsCollected', vdsstatus: 'vdsCollected',
  vdscollectiondate: 'vdsDate', vdscollectiondateddmmyy: 'vdsDate', vdsdate: 'vdsDate',
  vdschallancopy: 'vdsChallanLink', vdschallanlink: 'vdsChallanLink', vdslink: 'vdsChallanLink',
  vdschallannumber: 'vdsChallanNo', vdschallanno: 'vdsChallanNo',
  tdscollectionstatus: 'tdsCollected', tdsstatus: 'tdsCollected',
  tdscollectiondate: 'tdsDate', tdscollectiondateddmmyy: 'tdsDate', tdsdate: 'tdsDate',
  tdschallancopy: 'tdsChallanLink', tdschallanlink: 'tdsChallanLink', tdslink: 'tdsChallanLink',
  tdschallannumber: 'tdsChallanNo', tdschallanno: 'tdsChallanNo',
  remarks: 'remarks', remark: 'remarks',
  erpentrycompletedandrevieweddwithdirector: 'erpNote',
  erpentrycompletedandreviewedwithdirector: 'erpNote',
  erpentrycompletedandreviewedwithdirectorwithdate: 'erpNote',
  erpnote: 'erpNote'
};

export interface ParsedInvoiceSheet {
  rows: InvoiceImportRow[];
  warnings: string[];
  order: DateOrder;
  headerOk: boolean;
}

const emptyRow = (): InvoiceImportRow => ({
  forMonth: '', year: '', invoiceDate: '', client: '', jicName: '', jobNumber: '', purpose: '', invoiceNo: '', submissionNo: '',
  amount: '', tds: '', vds: '', clientSubmitted: '', clientSubmitDate: '', signedSubmitted: '', mailDate: '', collected: '',
  collectionDate: '', collectionMethod: '', paymentRef: '', vdsCollected: '', vdsDate: '', vdsChallanLink: '', vdsChallanNo: '',
  tdsCollected: '', tdsDate: '', tdsChallanLink: '', tdsChallanNo: '', remarks: '', erpNote: ''
});

/** Reads the invoice list (Excel export or old Google Sheet) saved as CSV. */
export function parseInvoiceSheet(text: string, forcedOrder?: DateOrder): ParsedInvoiceSheet {
  const table = parseCsv(text).filter(r => r.some(c => strip(c) !== ''));
  // The Excel export has a title above the column names: use the first row that has "Invoice Number"
  const hi = table.findIndex(r => r.some(c => HEADER_KEYS[norm(c)] === 'invoiceNo'));
  if (hi === -1) {
    return { rows: [], warnings: ['The column names were not found. The file needs at least "Invoice Number" and "Client Name" columns.'], order: 'DMY', headerOk: false };
  }
  const header = table[hi].map(norm);
  const col: Partial<Record<Key, number>> = {};
  let seenChallanNo = 0;
  header.forEach((h, i) => {
    if ((h.includes('vds') && (h.includes('copy') || h.includes('location') || h.includes('link') || h.includes('drive'))) && col.vdsChallanLink === undefined) {
      col.vdsChallanLink = i;
      return;
    }
    if ((h.includes('tds') && (h.includes('copy') || h.includes('location') || h.includes('link') || h.includes('drive'))) && col.tdsChallanLink === undefined) {
      col.tdsChallanLink = i;
      return;
    }
    if ((h === 'challannumber' || h === 'challanno')) {
      seenChallanNo++;
      if (seenChallanNo === 1 && col.vdsChallanNo === undefined) col.vdsChallanNo = i;
      else if (col.tdsChallanNo === undefined) col.tdsChallanNo = i;
      return;
    }
    const k = HEADER_KEYS[h];
    if (k && col[k] === undefined) col[k] = i;
  });
  const headerOk = col.invoiceNo !== undefined && col.client !== undefined;
  if (!headerOk) return { rows: [], warnings: ['The file needs "Invoice Number" and "Client Name" columns.'], order: 'DMY', headerOk };

  const body = table.slice(hi + 1);
  const dateCols = DATE_KEYS.map(k => col[k]).filter((c): c is number => c !== undefined);
  const order = forcedOrder || detectDateOrder([table[hi], ...body], dateCols);

  const warnings: string[] = [];
  const rows: InvoiceImportRow[] = [];
  body.forEach((r, idx) => {
    const line = hi + idx + 2;
    const get = (k: Key) => (col[k] === undefined ? '' : strip(r[col[k] as number] || ''));
    const row = emptyRow();
    (Object.keys(row) as Key[]).forEach(k => { row[k] = get(k); });
    if (!row.invoiceNo && !row.client) return;
    // the Excel export repeats a "Total" line at the bottom
    if (/^total$/i.test(row.client) || /^total$/i.test(row.invoiceNo)) return;

    DATE_KEYS.forEach(k => {
      const raw = row[k];
      if (!raw) return;
      // "Signed Invoice Mail" holds a date, or just "Yes"
      if (k === 'mailDate' && /^yes$/i.test(raw)) { row.mailDate = ''; row.signedSubmitted = 'Yes'; return; }
      const d = parseProposalDate(raw, order);
      if (!d) warnings.push(`Row ${line}: "${raw}" is not a date, so it was left empty.`);
      row[k] = d;
    });
    if (row.mailDate) row.signedSubmitted = 'Yes';

    MONEY_KEYS.forEach(k => {
      const raw = row[k];
      if (!raw) return;
      const n = Number(raw.replace(/[,৳\s]/g, ''));
      if (!Number.isFinite(n)) { warnings.push(`Row ${line}: "${raw}" is not an amount, so it was left empty.`); row[k] = ''; } else row[k] = String(n);
    });

    YESNO_KEYS.forEach(k => {
      const v = row[k].toLowerCase();
      row[k] = v === 'yes' || v === 'y' ? 'Yes' : v === 'no' || v === 'n' ? 'No' : '';
    });
    // a collection date means it was collected, even if the status column is blank
    if (!row.collected && row.collectionDate) row.collected = 'Yes';
    if (!row.clientSubmitted && row.clientSubmitDate) row.clientSubmitted = 'Yes';
    if (!row.vdsCollected && row.vdsDate) row.vdsCollected = 'Yes';
    if (!row.tdsCollected && row.tdsDate) row.tdsCollected = 'Yes';

    if (row.forMonth) {
      const m = MONTHS.find(x => x.toLowerCase().startsWith(row.forMonth.slice(0, 3).toLowerCase()));
      if (m) row.forMonth = m;
    }
    if (row.year && !/^\d{4}$/.test(row.year)) {
      const y = Number(row.year);
      row.year = Number.isInteger(y) && y >= 0 && y < 100 ? String(2000 + y) : '';
    }
    rows.push(row);
  });
  return { rows, warnings, order, headerOk };
}
