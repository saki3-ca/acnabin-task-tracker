import React, { useEffect, useMemo, useState } from 'react';
import { Copy, FileText, Plus, Save, Trash2 } from 'lucide-react';
import { DEFAULT_TDS_PCT, DEFAULT_VAT_PCT, MONTHS, toNum } from '../../lib/invoices';
import { currentMonth, fmtBDT, monthLabel, prevMonth, suggestParts } from '../../lib/firmCosting';
import { firmCostingService } from '../../services/firmCostingService';
import { invoiceService } from '../../services/invoiceService';
import { Client, FirmCostingRow, Invoice } from '../../types';

/** A client that is not in the client list: its id is made from the typed name, so the same name is always the same client. */
const CUSTOM_PREFIX = 'custom-';
const customId = (name: string): string => CUSTOM_PREFIX + name.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const customClient = (id: string, name: string): Client => ({ id, name, jobNumber: '', status: 'ACTIVE' });

let rowSeq = 0;
const newUid = () => `r${++rowSeq}`;

interface Draft {
  /** only for React keys and edits: a client can have several lines in a month */
  uid: string;
  /** invoice number or a short note, so each line can be told apart */
  note: string;
  clientId: string;
  clientName: string;
  engagement: 'RECURRING' | 'ONE_TIME';
  invoiceValue: string;
  vat: string;
  tax: string;
  budget: string;
  /** true = typed by hand, so the automatic VAT / tax suggestion must not overwrite it */
  vatTouched: boolean;
  taxTouched: boolean;
}

const toDraft = (r: FirmCostingRow): Draft => ({
  uid: newUid(), note: r.note || '',
  clientId: r.clientId, clientName: r.clientName, engagement: r.engagement,
  invoiceValue: r.invoiceValue ? String(r.invoiceValue) : '', vat: String(r.vat || ''), tax: String(r.tax || ''),
  budget: r.budget ? String(r.budget) : '', vatTouched: true, taxTouched: true
});

const num = (s: string) => Math.max(toNum(s), 0);

/** 1000000 -> 1,000,000 (keeps a typed decimal point) */
const withCommas = (s: string): string => {
  const [int, dec] = s.split('.');
  const g = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return dec === undefined ? g : `${g}.${dec}`;
};
const cleanNum = (s: string): string => {
  const raw = s.replace(/[^0-9.]/g, '');
  const [int, ...rest] = raw.split('.');
  return rest.length ? `${int}.${rest.join('').slice(0, 2)}` : int;
};
const round2 = (n: number): string => String(Math.round(n * 100) / 100);

/** Same client despite spelling: ignores case, spaces, punctuation and a bracketed short name like (FTML). */
const nameKey = (n: string) => n.toLowerCase().replace(/\([^)]*\)/g, '').replace(/[^a-z0-9]/g, '');

/** All invoices of one client (same name, or same job number). */
const invoicesOfClient = (all: Invoice[], client: Client): Invoice[] => {
  const key = nameKey(client.name);
  return all.filter(i => nameKey(i.client) === key || (Boolean(client.jobNumber) && i.jobNumber.trim() === client.jobNumber));
};

/** Invoices of a client for one calendar month (a single month in "For month", e.g. September 2026). */
const invoicesOf = (all: Invoice[], client: Client, month: string): Invoice[] => {
  const [y, m] = month.split('-').map(Number);
  const mon = (MONTHS[m - 1] || '').toLowerCase();
  return invoicesOfClient(all, client).filter(i => String(i.year).trim() === String(y) && i.forMonth.trim().toLowerCase() === mon);
};

/** Most recent invoice: latest invoice date, then latest saved. */
const latestInvoice = (list: Invoice[]): Invoice | null =>
  [...list].sort((a, b) => (b.invoiceDate || '').localeCompare(a.invoiceDate || '') || (b.createdAt || '').localeCompare(a.createdAt || ''))[0] || null;

interface Props {
  rows: FirmCostingRow[];
  clients: Client[];
  onSaved: () => Promise<void> | void;
}

export const MonthlyEntry: React.FC<Props> = ({ rows, clients, onSaved }) => {
  const [month, setMonth] = useState(currentMonth());
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [vatPct, setVatPct] = useState(String(DEFAULT_VAT_PCT));
  const [taxPct, setTaxPct] = useState(String(DEFAULT_TDS_PCT));
  const [pick, setPick] = useState('');
  const [otherName, setOtherName] = useState('');
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [invoicesDenied, setInvoicesDenied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // The Invoices tab data, used to fill the values (Admin and AD and above may not have the Invoices tab: then it stays empty)
  useEffect(() => {
    let on = true;
    invoiceService.list().then(l => { if (on) setInvoices(l); }).catch(() => { if (on) { setInvoices([]); setInvoicesDenied(true); } });
    return () => { on = false; };
  }, []);

  // Load the saved rows of the chosen month (only when the month changes, so typing is never overwritten)
  useEffect(() => {
    setDrafts(rows.filter(r => r.month === month).map(toDraft));
    setMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const pct = (s: string, fallback: number) => (s.trim() === '' || !Number.isFinite(Number(s)) ? fallback : Number(s));
  const withParts = (d: Draft, vp = vatPct, tp = taxPct): Draft => {
    const s = suggestParts(num(d.invoiceValue), pct(vp, DEFAULT_VAT_PCT), pct(tp, DEFAULT_TDS_PCT));
    return { ...d, vat: d.vatTouched ? d.vat : String(s.vat || ''), tax: d.taxTouched ? d.tax : String(s.tax || '') };
  };

  const update = (i: number, patch: Partial<Draft>) =>
    setDrafts(ds => ds.map((d, k) => (k === i ? withParts({ ...d, ...patch }) : d)));

  const setRate = (kind: 'vat' | 'tax', v: string) => {
    const clean = v.replace(/[^0-9.]/g, '');
    if (kind === 'vat') setVatPct(clean); else setTaxPct(clean);
    setDrafts(ds => ds.map(d => withParts(d, kind === 'vat' ? clean : vatPct, kind === 'tax' ? clean : taxPct)));
  };

  const available = useMemo(
    () => clients.filter(c => c.status !== 'INACTIVE').sort((a, b) => a.name.localeCompare(b.name)),
    [clients]
  );

  /**
   * Invoice value, VAT (VDS) and tax (TDS) from the Invoices tab: the client's invoices for the chosen month added together,
   * or, when there are none for that month, its latest invoice.
   */
  const fromInvoices = (client: Client): { fields: Partial<Draft>; note: string } | null => {
    if (!invoices) return null;
    let found = invoicesOf(invoices, client, month);
    let note = `${found.length} ${monthLabel(month, false)} invoice${found.length === 1 ? '' : 's'}`;
    if (found.length === 0) {
      const last = latestInvoice(invoicesOfClient(invoices, client));
      if (!last) return null;
      found = [last];
      note = `its latest invoice (${last.invoiceNo || 'no number'}${last.invoiceDate ? ', ' + last.invoiceDate : ''})`;
    }
    const value = found.reduce((t, i) => t + toNum(i.amount), 0);
    const vds = found.reduce((t, i) => t + toNum(i.vds), 0);
    const tds = found.reduce((t, i) => t + toNum(i.tds), 0);
    return {
      note,
      fields: {
        invoiceValue: round2(value),
        vat: vds > 0 ? round2(vds) : '', vatTouched: vds > 0,
        tax: tds > 0 ? round2(tds) : '', taxTouched: tds > 0
      }
    };
  };

  /** The client a line belongs to: from the client list, or typed in by hand. */
  const clientOf = (d: Draft): Client | undefined =>
    clients.find(x => x.id === d.clientId) || (d.clientId.startsWith(CUSTOM_PREFIX) ? customClient(d.clientId, d.clientName) : undefined);

  const fillFromInvoices = () => {
    let n = 0;
    const missing: string[] = [];
    const seen = new Set<string>();
    const next = drafts.map(d => {
      // only a client's first line is filled, so a second invoice line is never doubled up
      if (seen.has(d.clientId)) return d;
      seen.add(d.clientId);
      const c = clientOf(d);
      const f = c ? fromInvoices(c) : null;
      if (!f) { missing.push(d.clientName); return d; }
      n++;
      return withParts({ ...d, ...f.fields } as Draft);
    });
    setDrafts(next);
    setMsg({ ok: n > 0, text: n > 0 ? `Filled ${n} client${n === 1 ? '' : 's'} from the Invoices tab.${missing.length ? ` No invoice found for: ${missing.join(', ')}.` : ''}` : invoicesDenied ? 'You do not have access to the Invoices tab, so nothing can be filled from it.' : 'No invoices found for these clients.' });
  };

  /** Another invoice line for a client already in the month; typed by hand. */
  const addLine = (clientId: string, after: number) => {
    const d = drafts[after];
    const line: Draft = { uid: newUid(), note: '', clientId, clientName: d.clientName, engagement: d.engagement, invoiceValue: '', vat: '', tax: '', budget: '', vatTouched: false, taxTouched: false };
    setDrafts(ds => [...ds.slice(0, after + 1), line, ...ds.slice(after + 1)]);
    setMsg({ ok: true, text: `Added another line for ${d.clientName}. Type its invoice value${' (and an invoice no. in the box under the name)'}.` });
  };

  const addOther = () => {
    const name = otherName.trim().replace(/\s+/g, ' ');
    if (name.length < 2) { setMsg({ ok: false, text: 'Type the client name first.' }); return; }
    const id = customId(name);
    if (id === CUSTOM_PREFIX) { setMsg({ ok: false, text: 'The client name needs letters or numbers.' }); return; }
    // the same name as a client in the list: use that client, so its cost and history stay together
    const listed = clients.find(c => c.name.trim().toLowerCase() === name.toLowerCase());
    addClient(listed ? listed.id : id, listed ? undefined : name);
    setOtherName('');
  };

  const addClient = (id: string, typedName?: string) => {
    const c = clients.find(x => x.id === id) || (typedName ? customClient(id, typedName) : undefined);
    if (!c) return;
    const first = drafts.findIndex(d => d.clientId === id);
    if (first >= 0) {
      // already in this month: add a separate invoice line to type by hand
      let last = first;
      drafts.forEach((d, k) => { if (d.clientId === id) last = k; });
      addLine(id, last);
      setPick('');
      return;
    }
    // keep the same engagement type as the client's earlier months
    const earlier = rows.filter(r => r.clientId === id).sort((a, b) => b.month.localeCompare(a.month))[0];
    const base: Draft = { uid: newUid(), note: '', clientId: c.id, clientName: c.name, engagement: earlier?.engagement || 'RECURRING', invoiceValue: '', vat: '', tax: '', budget: earlier?.budget ? String(earlier.budget) : '', vatTouched: false, taxTouched: false };
    const f = fromInvoices(c);
    setDrafts(ds => [...ds, withParts(f ? { ...base, ...f.fields } as Draft : base)]);
    setMsg(f ? { ok: true, text: `${c.name}: filled from ${f.note}.` } : { ok: false, text: invoicesDenied ? `${c.name}: you do not have access to the Invoices tab, so type the value.` : `${c.name}: no invoice found in the Invoices tab. Type the value.` });
    setPick('');
  };

  const copyPrevious = () => {
    const prev = rows.filter(r => r.month === prevMonth(month) && !drafts.some(d => d.clientId === r.clientId)).filter((r, k, arr) => arr.findIndex(x => x.clientId === r.clientId) === k);
    if (prev.length === 0) { setMsg({ ok: false, text: `${monthLabel(prevMonth(month), false)} has no clients to copy.` }); return; }
    setDrafts(ds => [...ds, ...prev.map(r => ({ ...toDraft(r), note: '', invoiceValue: '', vat: '', tax: '', vatTouched: false, taxTouched: false }))]);
    setMsg({ ok: true, text: `Copied ${prev.length} client${prev.length === 1 ? '' : 's'} from ${monthLabel(prevMonth(month), false)} with their budgets. Type this month's invoice values.` });
  };

  const totals = useMemo(() => drafts.reduce((t, d) => {
    const v = num(d.invoiceValue), vat = num(d.vat), tax = num(d.tax);
    return { gross: t.gross + v, vat: t.vat + vat, tax: t.tax + tax, net: t.net + (v - vat - tax), budget: t.budget + num(d.budget) };
  }, { gross: 0, vat: 0, tax: 0, net: 0, budget: 0 }), [drafts]);

  const save = async () => {
    const bad = drafts.find(d => num(d.vat) + num(d.tax) > num(d.invoiceValue));
    if (bad) { setMsg({ ok: false, text: `${bad.clientName}: VAT plus tax is more than the invoice value.` }); return; }
    const out: FirmCostingRow[] = drafts
      .filter(d => num(d.invoiceValue) > 0 || num(d.budget) > 0)
      .map(d => ({ month, clientId: d.clientId, clientName: d.clientName, note: d.note.trim(), engagement: d.engagement, invoiceValue: num(d.invoiceValue), vat: num(d.vat), tax: num(d.tax), budget: num(d.budget) }));
    setSaving(true);
    setMsg(null);
    try {
      await firmCostingService.saveMonth(month, out);
      await onSaved();
      setMsg({ ok: true, text: `Saved ${out.length} line${out.length === 1 ? '' : 's'} for ${monthLabel(month, false)}.` });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not save.' });
    } finally {
      setSaving(false);
    }
  };

  const cell: React.CSSProperties = { padding: '6px 8px' };
  const inp: React.CSSProperties = { height: 34, fontSize: 12.5, width: '100%', textAlign: 'right' };

  return (
    <div className="fc-glass fc-t7" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end', marginBottom: 14 }}>
        <div className="form-field" style={{ margin: 0 }}>
          <label>Month</label>
          <input type="month" className="form-input" value={month} onChange={e => e.target.value && setMonth(e.target.value)} style={{ height: 36 }} />
        </div>
        <div className="form-field" style={{ margin: 0, width: 90 }}>
          <label>VAT %</label>
          <input className="form-input" inputMode="decimal" value={vatPct} onChange={e => setRate('vat', e.target.value)} style={{ height: 36 }} />
        </div>
        <div className="form-field" style={{ margin: 0, width: 90 }}>
          <label>Tax %</label>
          <input className="form-input" inputMode="decimal" value={taxPct} onChange={e => setRate('tax', e.target.value)} style={{ height: 36 }} />
        </div>
        <div className="form-field" style={{ margin: 0, minWidth: 220 }}>
          <label>Add client</label>
          <select className="form-select" value={pick} onChange={e => addClient(e.target.value)} style={{ height: 36 }}>
            <option value="">Select a client…</option>
            {available.map(c => <option key={c.id} value={c.id}>{c.name}{c.jobNumber ? ` (${c.jobNumber})` : ''}</option>)}
          </select>
        </div>
        <div className="form-field" style={{ margin: 0, minWidth: 240 }}>
          <label>Client not in the list</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="form-input" placeholder="Type a client name" value={otherName} onChange={e => setOtherName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addOther(); }} style={{ height: 36, flex: 1 }} />
            <button className="btn btn-secondary btn-sm" onClick={addOther} style={{ height: 36 }} title="Add this client to the month"><Plus size={14} /> Add</button>
          </div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={copyPrevious} style={{ height: 36, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Copy size={14} /> Copy clients from {monthLabel(prevMonth(month))}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={fillFromInvoices} disabled={!invoices || drafts.length === 0} title="Fill the listed clients' invoice value, VAT and tax from the Invoices tab for this month" style={{ height: 36, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <FileText size={14} /> Fill from Invoices
        </button>
      </div>

      <p style={{ fontSize: 12, color: 'var(--ink-muted)', margin: '0 0 10px' }}>
        Invoice value includes VAT and tax. VAT and tax fill in from the rates above (type over them to change). Net revenue = invoice value − VAT − tax. Adding a client fills its value from the Invoices tab: that month's invoices, or its latest invoice if it has none that month (or use Fill from Invoices). A client that is not in the client list can be typed in; its invoices are matched by name too, and it has no manpower cost. A client can have several lines in a month (use + on its row, or pick it again): each line is one invoice, and the dashboard adds them up. Lines with no invoice value and no budget are not saved.
      </p>

      <div className="table-responsive">
        <table className="data-table" style={{ minWidth: 980 }}>
          <thead>
            <tr>
              <th>Client</th>
              <th style={{ width: 120 }}>Engagement</th>
              <th style={{ width: 130, textAlign: 'right' }}>Invoice value</th>
              <th style={{ width: 110, textAlign: 'right' }}>VAT</th>
              <th style={{ width: 110, textAlign: 'right' }}>Tax</th>
              <th style={{ width: 130, textAlign: 'right' }}>Net revenue</th>
              <th style={{ width: 130, textAlign: 'right' }}>Budget (net)</th>
              <th style={{ width: 84 }} />
            </tr>
          </thead>
          <tbody>
            {drafts.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--ink-muted)' }}>No clients for {monthLabel(month, false)} yet. Add a client above{rows.some(r => r.month === prevMonth(month)) ? ' or copy last month' : ''}.</td></tr>
            )}
            {drafts.map((d, i) => (
              <tr key={d.uid}>
                <td style={cell}>
                  <div style={{ fontWeight: 600, color: i > 0 && drafts[i - 1].clientId === d.clientId ? 'var(--ink-muted)' : undefined }}>
                    {i > 0 && drafts[i - 1].clientId === d.clientId ? '↳ ' : ''}{d.clientName}
                  </div>
                  <input className="form-input" placeholder="Invoice no. / note (optional)" value={d.note} onChange={e => update(i, { note: e.target.value })} style={{ height: 28, fontSize: 11.5, marginTop: 3, width: '100%' }} />
                </td>
                <td style={cell}>
                  <select className="form-select" value={d.engagement} onChange={e => update(i, { engagement: e.target.value as Draft['engagement'] })} style={{ height: 34, fontSize: 12.5 }}>
                    <option value="RECURRING">Recurring</option>
                    <option value="ONE_TIME">One-time</option>
                  </select>
                </td>
                <td style={cell}><input className="form-input" inputMode="decimal" value={withCommas(d.invoiceValue)} onChange={e => update(i, { invoiceValue: cleanNum(e.target.value) })} style={inp} /></td>
                <td style={cell}><input className="form-input" inputMode="decimal" value={withCommas(d.vat)} onChange={e => update(i, { vat: cleanNum(e.target.value), vatTouched: true })} style={inp} /></td>
                <td style={cell}><input className="form-input" inputMode="decimal" value={withCommas(d.tax)} onChange={e => update(i, { tax: cleanNum(e.target.value), taxTouched: true })} style={inp} /></td>
                <td style={{ ...cell, textAlign: 'right', fontWeight: 600 }}>{fmtBDT(num(d.invoiceValue) - num(d.vat) - num(d.tax))}</td>
                <td style={cell}><input className="form-input" inputMode="decimal" value={withCommas(d.budget)} onChange={e => update(i, { budget: cleanNum(e.target.value) })} style={inp} /></td>
                <td style={{ ...cell, whiteSpace: 'nowrap' }}>
                  <button className="btn btn-secondary btn-sm" title="Add another invoice line for this client" onClick={() => addLine(d.clientId, i)} style={{ padding: '4px 8px', marginRight: 4 }}><Plus size={13} /></button>
                  <button className="btn btn-secondary btn-sm" title="Remove this line" onClick={() => setDrafts(ds => ds.filter((_, k) => k !== i))} style={{ padding: '4px 8px', color: 'var(--fc-bad)' }}><Trash2 size={13} /></button>
                </td>
              </tr>
            ))}
          </tbody>
          {drafts.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td style={cell} colSpan={2}>Total ({drafts.length} line{drafts.length === 1 ? '' : 's'})</td>
                <td style={{ ...cell, textAlign: 'right' }}>{fmtBDT(totals.gross)}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{fmtBDT(totals.vat)}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{fmtBDT(totals.tax)}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{fmtBDT(totals.net)}</td>
                <td style={{ ...cell, textAlign: 'right' }}>{fmtBDT(totals.budget)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={save} disabled={saving} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Save size={14} /> {saving ? 'Saving…' : `Save ${monthLabel(month, false)}`}
        </button>
        
        {msg && <span style={{ fontSize: 12.5, color: msg.ok ? 'var(--fc-good)' : 'var(--fc-bad)' }}>{msg.text}</span>}
      </div>
    </div>
  );
};
