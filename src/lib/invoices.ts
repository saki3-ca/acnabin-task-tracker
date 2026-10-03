// Small helpers for the Invoices tab: tax suggestions, month suggestion, money format.

export const DEFAULT_VAT_PCT = 15;
export const DEFAULT_TDS_PCT = 7.5;

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const COLLECTION_METHODS = ['BEFTN', 'Cheque', 'Bank Transfer', 'Cash'];

export const toNum = (s: string | number | undefined | null): number => {
  const n = Number(String(s ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};

export const fmtMoney = (n: number): string => n.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** The invoice amount includes VAT: VDS is the VAT part, TDS is a share of the amount without VAT. */
export const suggestTaxes = (amount: string, tdsPct: number, vatPct: number): { tds: string; vds: string } => {
  const a = toNum(amount);
  if (a <= 0) return { tds: '', vds: '' };
  const base = a / (1 + vatPct / 100);
  return { tds: String(Math.round((base * tdsPct) / 100)), vds: String(Math.round((base * vatPct) / 100)) };
};

/** Most invoices are for the month before the invoice date. */
export const suggestPeriod = (iso: string): { forMonth: string; year: string } | null => {
  const m = /^(\d{4})-(\d{2})-\d{2}/.exec(iso || '');
  if (!m) return null;
  let y = Number(m[1]);
  let mo = Number(m[2]) - 2; // previous month, 0-based
  if (mo < 0) {
    mo = 11;
    y -= 1;
  }
  return { forMonth: MONTHS[mo], year: String(y) };
};

export const isYes = (v: string) => v === 'Yes';
export const norm = (s: string) => s.trim().toLowerCase();

export const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};
