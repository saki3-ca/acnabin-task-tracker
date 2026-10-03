import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Paperclip, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { downloadInvoicesExcel } from '../../lib/invoicesExcel';
import {
  COLLECTION_METHODS, DEFAULT_TDS_PCT, DEFAULT_VAT_PCT, fmtDate, fmtMoney, isYes, MONTHS, norm, suggestPeriod, suggestTaxes, toNum
} from '../../lib/invoices';
import { MAX_FILE_BYTES } from '../../lib/driveFiles';
import { uploadQueue } from '../../lib/uploadQueue';
import { useLivePolling } from '../../lib/useLivePolling';
import { invoiceService } from '../../services/invoiceService';
import { Invoice, InvoiceAttachment } from '../../types';
import { StatPills } from '../dashboard/StatPills';
import { Modal } from '../ui/Modal';
import { InvoiceFilesModal } from './InvoiceFilesModal';

type Form = Omit<Invoice, 'id' | 'createdAt'>;
const EMPTY: Form = {
  forMonth: '', year: '', invoiceDate: '', client: '', jicName: '', jobNumber: '', purpose: '', invoiceNo: '', submissionNo: '',
  amount: '', tds: '', vds: '', signedSubmitted: 'No', mailDate: '', collected: 'No', collectionDate: '', collectionMethod: '', paymentRef: '',
  vdsCollected: 'No', vdsDate: '', vdsChallanLink: '', vdsChallanNo: '', tdsCollected: 'No', tdsDate: '', tdsChallanLink: '', tdsChallanNo: '',
  remarks: '', erpNote: ''
};

const Chip: React.FC<{ value: string; dateIso?: string }> = ({ value, dateIso }) => {
  const yes = isYes(value);
  const set = value === 'Yes' || value === 'No';
  return (
    <span
      title={yes && dateIso ? fmtDate(dateIso) : undefined}
      style={{
        display: 'inline-block', padding: '2px 9px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap',
        background: yes ? '#DCFCE7' : set ? '#FEE2E2' : '#E5E7EB', color: yes ? '#166534' : set ? '#991B1B' : '#374151'
      }}
    >
      {yes ? 'Yes' : set ? 'No' : '—'}
    </span>
  );
};

const YesNo: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <select className="form-select" value={value} onChange={e => onChange(e.target.value)}>
    <option value="No">No</option>
    <option value="Yes">Yes</option>
  </select>
);

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' };
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'end' };
const sectionTitle: React.CSSProperties = { fontSize: '12px', fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--navy)', margin: '16px 0 8px', paddingBottom: '4px', borderBottom: '1px solid var(--line)' };

export const InvoiceTracker: React.FC = () => {
  const { currentUser, allClients, allUsers } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [attachments, setAttachments] = useState<InvoiceAttachment[]>([]);
  const [driveUrl, setDriveUrl] = useState('');
  const [filesFor, setFilesFor] = useState<{ id: string; kind: 'VDS' | 'TDS' } | null>(null);
  const [queued, setQueued] = useState<{ VDS: File[]; TDS: File[] }>({ VDS: [], TDS: [] });
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [show, setShow] = useState<'ALL' | 'OUT' | 'COL'>('ALL');

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [tdsPct, setTdsPct] = useState(String(DEFAULT_TDS_PCT));
  const [vatPct, setVatPct] = useState(String(DEFAULT_VAT_PCT));
  // true = the person typed it, so the automatic suggestion must not overwrite it
  const [touched, setTouched] = useState({ tds: false, vds: false, period: false, job: false });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(async () => {
    try {
      const [rows, files, url] = await Promise.all([
        invoiceService.list(),
        invoiceService.listAttachments().catch(() => [] as InvoiceAttachment[]),
        invoiceService.getDriveUrl().catch(() => '')
      ]);
      const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
      setInvoices(prev => (same(prev, rows) ? prev : rows));
      setAttachments(prev => (same(prev, files) ? prev : files));
      setDriveUrl(url);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load invoices.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, currentUser?.id]);
  useLivePolling(() => load(), 30000, !modalOpen);

  // A background upload finished: refresh the file counts
  useEffect(() => {
    const onFiles = () => void load();
    window.addEventListener('invoice-files-changed', onFiles);
    return () => window.removeEventListener('invoice-files-changed', onFiles);
  }, [load]);

  const filesOf = (id: string, kind: 'VDS' | 'TDS') => attachments.filter(a => a.invoiceId === id && a.kind === kind);

  const stats = useMemo(() => {
    let invoiced = 0;
    let collected = 0;
    let vdsPending = 0;
    let tdsPending = 0;
    invoices.forEach(i => {
      const a = toNum(i.amount);
      invoiced += a;
      if (isYes(i.collected)) collected += a;
      if (!isYes(i.vdsCollected) && toNum(i.vds) > 0) vdsPending += 1;
      if (!isYes(i.tdsCollected) && toNum(i.tds) > 0) tdsPending += 1;
    });
    return { invoiced, collected, outstanding: invoiced - collected, vdsPending, tdsPending };
  }, [invoices]);

  const rows = useMemo(() => {
    const q = norm(search);
    return invoices.filter(i => {
      if (show === 'OUT' && isYes(i.collected)) return false;
      if (show === 'COL' && !isYes(i.collected)) return false;
      if (!q) return true;
      return [i.client, i.invoiceNo, i.submissionNo, i.jobNumber, i.jicName, i.purpose, i.forMonth].some(v => norm(v || '').includes(q));
    });
  }, [invoices, search, show]);

  const lists = useMemo(() => {
    const uniq = (xs: string[]) => [...new Set(xs.map(x => x.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return {
      clients: uniq([...allClients.map(c => c.name), ...invoices.map(i => i.client)]),
      jics: uniq([...allUsers.filter(u => u.status === 'ACTIVE').map(u => u.name), ...invoices.map(i => i.jicName)]),
      purposes: uniq(invoices.map(i => i.purpose))
    };
  }, [allClients, allUsers, invoices]);

  const dupNumber = useMemo(
    () => Boolean(form.invoiceNo.trim()) && invoices.some(i => i.id !== editingId && norm(i.invoiceNo) === norm(form.invoiceNo)),
    [form.invoiceNo, invoices, editingId]
  );

  const openModal = (inv?: Invoice) => {
    setEditingId(inv ? inv.id : null);
    if (inv) {
      const { id: _id, createdAt: _c, ...rest } = inv;
      setForm({ ...EMPTY, ...rest });
      setTouched({ tds: true, vds: true, period: true, job: true }); // saved values are never overwritten by a suggestion
    } else {
      setForm(EMPTY);
      setTouched({ tds: false, vds: false, period: false, job: false });
    }
    setTdsPct(String(DEFAULT_TDS_PCT));
    setVatPct(String(DEFAULT_VAT_PCT));
    setQueued({ VDS: [], TDS: [] });
    setFileNote(null);
    setFormError(null);
    setModalOpen(true);
  };

  const pct = (s: string, fallback: number) => (s.trim() === '' || !Number.isFinite(Number(s)) ? fallback : Number(s));

  /** Recompute the suggested TDS / VDS for any of them the person has not typed themselves */
  const withTaxes = (f: Form, t: { tds: boolean; vds: boolean }, tp: string, vp: string): Form => {
    const s = suggestTaxes(f.amount, pct(tp, DEFAULT_TDS_PCT), pct(vp, DEFAULT_VAT_PCT));
    return { ...f, tds: t.tds ? f.tds : s.tds, vds: t.vds ? f.vds : s.vds };
  };

  const setAmount = (amount: string) => setForm(f => withTaxes({ ...f, amount }, touched, tdsPct, vatPct));
  const setRate = (kind: 'tds' | 'vat', v: string) => {
    const tp = kind === 'tds' ? v : tdsPct;
    const vp = kind === 'vat' ? v : vatPct;
    if (kind === 'tds') setTdsPct(v);
    else setVatPct(v);
    setForm(f => withTaxes(f, touched, tp, vp));
  };
  const resetAuto = (field: 'tds' | 'vds') => {
    const t = { ...touched, [field]: false };
    setTouched(t);
    setForm(f => withTaxes(f, t, tdsPct, vatPct));
  };
  const setInvoiceDate = (invoiceDate: string) =>
    setForm(f => {
      const p = !touched.period ? suggestPeriod(invoiceDate) : null;
      return { ...f, invoiceDate, ...(p ?? {}) };
    });
  const setClient = (client: string) =>
    setForm(f => {
      const known = allClients.find(c => norm(c.name) === norm(client));
      return { ...f, client, jobNumber: !touched.job && known?.jobNumber ? known.jobNumber : f.jobNumber };
    });

  const pickFiles = (kind: 'VDS' | 'TDS', list: FileList | null) => {
    if (!list) return;
    const ok: File[] = [];
    const bad: string[] = [];
    Array.from(list).forEach(f => (f.size === 0 || f.size > MAX_FILE_BYTES ? bad.push(f.name) : ok.push(f)));
    setFileNote(bad.length ? `Not added (empty or bigger than 100 MB): ${bad.join(', ')}` : null);
    if (ok.length) setQueued(q => ({ ...q, [kind]: [...q[kind], ...ok] }));
  };

  const save = async (force = false) => {
    if (!form.invoiceNo.trim() || !form.client.trim()) {
      setFormError('Invoice number and Client name are required.');
      return;
    }
    if (dupNumber) {
      setFormError('This invoice number already exists. An invoice number cannot be used twice.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const id = editingId || `i${Date.now()}`;
      await invoiceService.save({ id, ...form, invoiceNo: form.invoiceNo.trim(), client: form.client.trim() } as Partial<Invoice>, force);
      // the files go up in the background, after the invoice is saved
      (['VDS', 'TDS'] as const).forEach(kind => {
        if (queued[kind].length > 0) uploadQueue.addInvoice(driveUrl, { id, invoiceNo: form.invoiceNo.trim(), kind }, queued[kind]);
      });
      setModalOpen(false);
      showToast(editingId ? 'Changes saved' : 'Invoice added');
      await load();
    } catch (e: any) {
      if (e?.code === 'SUBMISSION_DUP') {
        setSaving(false);
        if (window.confirm(`Submission number "${form.submissionNo.trim()}" is already used by another invoice.\n\nDo you still want to save this invoice with the same submission number?`)) {
          await save(true);
        }
        return;
      }
      setFormError(e?.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (inv: Invoice) => {
    if (!window.confirm(`Delete invoice ${inv.invoiceNo} (${inv.client})? This cannot be undone.`)) return;
    try {
      await invoiceService.remove(inv.id);
      showToast('Invoice deleted');
      await load();
    } catch (e: any) {
      showToast(e?.message || 'Could not delete.');
    }
  };

  const exportExcel = async () => {
    try {
      await downloadInvoicesExcel(rows, `ACNABIN_Invoices_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      window.alert('Could not create the Excel file. Please try again.');
    }
  };

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => ({ ...f, [k]: v }));
  const th: React.CSSProperties = { textAlign: 'center' };
  const bannerBtn: React.CSSProperties = { height: '32px', padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', borderRadius: '6px' };
  const money = (s: string) => (s && toNum(s) !== 0 ? fmtMoney(toNum(s)) : '—');
  const rowBtn = (title: string, onClick: () => void, icon: React.ReactNode, color?: string, ml = 0) => (
    <button className="btn btn-secondary btn-sm" onClick={onClick} title={title} style={{ padding: '4px 8px', marginLeft: ml, color }}>{icon}</button>
  );

  /** Uploaded files open a list; an old Drive link alone opens that link straight away; nothing yet = a + to add. */
  const challanCell = (i: Invoice, kind: 'VDS' | 'TDS') => {
    const n = filesOf(i.id, kind).length;
    const legacy = (kind === 'VDS' ? i.vdsChallanLink : i.tdsChallanLink).trim();
    const btn: React.CSSProperties = { padding: '3px 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', minWidth: '52px', height: '28px' };
    if (n === 0 && /^https?:\/\//i.test(legacy)) {
      return (
        <a className="btn btn-secondary btn-sm" href={legacy} target="_blank" rel="noreferrer" title={`Open the existing ${kind} challan in Google Drive`} style={{ ...btn, textDecoration: 'none' }}>
          <ExternalLink size={13} /> Open
        </a>
      );
    }
    if (n > 0 || legacy) {
      return (
        <button className="btn btn-secondary btn-sm" style={btn} onClick={() => setFilesFor({ id: i.id, kind })} title={n > 0 ? `${n} file${n === 1 ? '' : 's'}: click to view` : legacy}>
          <Paperclip size={13} /> {n > 0 ? n : '—'}
        </button>
      );
    }
    return (
      <button className="btn btn-secondary btn-sm" style={{ ...btn, minWidth: '40px', color: 'var(--ink-muted)' }} onClick={() => setFilesFor({ id: i.id, kind })} title={`Add ${kind} challan files`}>
        <Plus size={13} />
      </button>
    );
  };

  return (
    <div className="tab-pane">
      {loadError ? (
        <div className="auth-alert-error">{loadError}</div>
      ) : loading ? (
        <div className="loading-indicator">Loading invoices…</div>
      ) : (
        <>
          <StatPills
            variant="maroon"
            items={[
              { label: 'INVOICES', value: invoices.length },
              { label: 'INVOICED (৳)', value: fmtMoney(stats.invoiced) },
              { label: 'COLLECTED (৳)', value: fmtMoney(stats.collected) },
              { label: 'OUTSTANDING (৳)', value: fmtMoney(stats.outstanding), isOverdue: stats.outstanding > 0 },
              { label: 'VDS PENDING', value: stats.vdsPending, isOverdue: stats.vdsPending > 0 },
              { label: 'TDS PENDING', value: stats.tdsPending, isOverdue: stats.tdsPending > 0 }
            ]}
          />

          <div className="table-card">
            <div className="banner-strip banner-teal" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 14px' }}>
              <span />
              <span>INVOICES</span>
              <span style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button className="btn btn-sm" style={{ ...bannerBtn, background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }} onClick={exportExcel}>
                  <Download size={14} /> Excel
                </button>
                <button className="btn btn-sm" style={{ ...bannerBtn, background: '#fff', color: 'var(--teal-dark)', border: 'none' }} onClick={() => openModal()}>
                  <Plus size={14} /> New Invoice
                </button>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', padding: '10px 14px', flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--line)' }}>
              <input className="form-input" placeholder="Search client, invoice no., job no., JIC…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: '320px' }} />
              <select className="form-select" value={show} onChange={e => setShow(e.target.value as 'ALL' | 'OUT' | 'COL')} style={{ maxWidth: '200px' }}>
                <option value="ALL">All invoices</option>
                <option value="OUT">Not collected yet</option>
                <option value="COL">Collected</option>
              </select>
              <span style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>{rows.length} shown</span>
            </div>

            <div className="table-responsive">
              <table className="data-table" style={{ minWidth: '1590px', tableLayout: 'fixed' }}>
                <colgroup>
                  <col style={{ width: '44px' }} />
                  <col style={{ width: '92px' }} />
                  <col style={{ width: '104px' }} />
                  <col style={{ width: '220px' }} />
                  <col style={{ width: '82px' }} />
                  <col style={{ width: '120px' }} />
                  <col style={{ width: '176px' }} />
                  <col style={{ width: '102px' }} />
                  <col style={{ width: '86px' }} />
                  <col style={{ width: '86px' }} />
                  <col style={{ width: '86px' }} />
                  <col style={{ width: '70px' }} />
                  <col style={{ width: '70px' }} />
                  <col style={{ width: '78px' }} />
                  <col style={{ width: '78px' }} />
                  <col style={{ width: '96px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th colSpan={8} style={{ border: 'none' }} />
                    <th colSpan={3} style={{ textAlign: 'center', background: '#DCE6F4', color: '#1B2A6B' }}>Amount (৳)</th>
                    <th colSpan={3} style={{ textAlign: 'center', background: '#DCE6F4', color: '#1B2A6B' }}>Collected?</th>
                    <th colSpan={2} style={{ textAlign: 'center', background: '#DCE6F4', color: '#1B2A6B' }}>Challan copy</th>
                    <th style={{ border: 'none' }} />
                  </tr>
                  <tr>
                    <th style={th}>SL</th>
                    <th style={th}>Month</th>
                    <th style={th}>Invoice Date</th>
                    <th style={th}>Client / JIC</th>
                    <th style={th}>Job No.</th>
                    <th style={th}>Purpose</th>
                    <th style={th}>Invoice / Submission No.</th>
                    <th style={th}>Invoice Amount</th>
                    <th style={th}>TDS</th>
                    <th style={th}>VDS</th>
                    <th style={th}>Payment</th>
                    <th style={th}>VDS</th>
                    <th style={th}>TDS</th>
                    <th style={th}>VDS</th>
                    <th style={th}>TDS</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={16} style={{ textAlign: 'center', padding: '30px', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                        {invoices.length === 0 ? 'No invoices yet. Click “New Invoice” to add the first one.' : 'No invoices match.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((i, n) => (
                      <tr key={i.id}>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{n + 1}</td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={`${i.forMonth} ${i.year}`}>
                          {i.forMonth || '—'}
                          <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{i.year}</div>
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap', fontSize: '13px' }}>{fmtDate(i.invoiceDate)}</td>
                        <td style={{ textAlign: 'left', overflow: 'hidden' }} title={`${i.client}${i.jicName ? ' · ' + i.jicName : ''}`}>
                          <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.client}</div>
                          <div style={{ fontSize: '12px', color: 'var(--ink-soft)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.jicName || '—'}</div>
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>{i.jobNumber || '—'}</td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={i.purpose}>{i.purpose || '—'}</td>
                        <td style={{ textAlign: 'center', overflow: 'hidden' }}>
                          <div style={{ fontWeight: 600, fontSize: '12.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={i.invoiceNo}>{i.invoiceNo}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--ink-soft)' }}>{i.submissionNo || '—'}</div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>{money(i.amount)}</td>
                        <td style={{ textAlign: 'right' }}>{money(i.tds)}</td>
                        <td style={{ textAlign: 'right' }}>{money(i.vds)}</td>
                        <td style={{ textAlign: 'center' }}><Chip value={i.collected} dateIso={i.collectionDate} /></td>
                        <td style={{ textAlign: 'center' }}><Chip value={i.vdsCollected} dateIso={i.vdsDate} /></td>
                        <td style={{ textAlign: 'center' }}><Chip value={i.tdsCollected} dateIso={i.tdsDate} /></td>
                        <td style={{ textAlign: 'center' }}>{challanCell(i, 'VDS')}</td>
                        <td style={{ textAlign: 'center' }}>{challanCell(i, 'TDS')}</td>
                        <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                          {rowBtn('Edit', () => openModal(i), <Pencil size={13} />)}
                          {isAdmin && rowBtn('Delete (Admin)', () => void remove(i), <Trash2 size={13} />, '#B91C1C', 6)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <InvoiceFilesModal
        invoice={filesFor ? invoices.find(x => x.id === filesFor.id) || null : null}
        kind={filesFor?.kind || 'VDS'}
        files={filesFor ? filesOf(filesFor.id, filesFor.kind) : []}
        driveUrl={driveUrl}
        isAdmin={isAdmin}
        onClose={() => setFilesFor(null)}
        onChanged={() => void load()}
      />

      <Modal isOpen={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editingId ? 'Edit Invoice' : 'New Invoice'} maxWidth="760px">
        <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
          <datalist id="inv-clients">{lists.clients.map(c => <option key={c} value={c} />)}</datalist>
          <datalist id="inv-jics">{lists.jics.map(c => <option key={c} value={c} />)}</datalist>
          <datalist id="inv-purposes">{lists.purposes.map(c => <option key={c} value={c} />)}</datalist>
          <datalist id="inv-months">{MONTHS.map(c => <option key={c} value={c} />)}</datalist>
          <datalist id="inv-methods">{COLLECTION_METHODS.map(c => <option key={c} value={c} />)}</datalist>

          <div style={{ ...sectionTitle, marginTop: 0 }}>Invoice</div>
          <div style={grid3}>
            <div className="form-field">
              <label>Invoice date</label>
              <input type="date" className="form-input" value={form.invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div className="form-field">
              <label>For the month</label>
              <input className="form-input" list="inv-months" value={form.forMonth} onChange={e => { setTouched(t => ({ ...t, period: true })); set('forMonth', e.target.value); }} placeholder="e.g. July or July-September" />
            </div>
            <div className="form-field">
              <label>Year</label>
              <input className="form-input" inputMode="numeric" value={form.year} onChange={e => { setTouched(t => ({ ...t, period: true })); set('year', e.target.value.replace(/\D/g, '').slice(0, 4)); }} />
            </div>
          </div>
          <div style={grid2}>
            <div className="form-field">
              <label>Client name</label>
              <input className="form-input" list="inv-clients" value={form.client} onChange={e => setClient(e.target.value)} />
            </div>
            <div className="form-field">
              <label>JIC name</label>
              <input className="form-input" list="inv-jics" value={form.jicName} onChange={e => set('jicName', e.target.value)} />
            </div>
          </div>
          <div style={grid3}>
            <div className="form-field">
              <label>Job number</label>
              <input className="form-input" value={form.jobNumber} onChange={e => { setTouched(t => ({ ...t, job: true })); set('jobNumber', e.target.value); }} />
            </div>
            <div className="form-field">
              <label>Purpose</label>
              <input className="form-input" list="inv-purposes" value={form.purpose} onChange={e => set('purpose', e.target.value)} />
            </div>
            <div />
          </div>
          <div style={grid2}>
            <div className="form-field">
              <label>Invoice number (cannot repeat)</label>
              <input className="form-input" value={form.invoiceNo} onChange={e => set('invoiceNo', e.target.value)} style={dupNumber ? { borderColor: '#B91C1C' } : undefined} />
              {dupNumber && <div style={{ color: '#B91C1C', fontSize: '12px', marginTop: '3px' }}>This invoice number already exists.</div>}
            </div>
            <div className="form-field">
              <label>Submission number</label>
              <input className="form-input" value={form.submissionNo} onChange={e => set('submissionNo', e.target.value)} />
            </div>
          </div>

          <div style={sectionTitle}>Amount (suggested automatically, you can change it)</div>
          <div style={grid3}>
            <div className="form-field">
              <label>Invoice amount ৳ (incl. VAT)</label>
              <input className="form-input" inputMode="decimal" value={form.amount} onChange={e => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
            </div>
            <div className="form-field">
              <label>TDS rate %</label>
              <input className="form-input" inputMode="decimal" value={tdsPct} onChange={e => setRate('tds', e.target.value.replace(/[^0-9.]/g, ''))} />
            </div>
            <div className="form-field">
              <label>VAT rate %</label>
              <input className="form-input" inputMode="decimal" value={vatPct} onChange={e => setRate('vat', e.target.value.replace(/[^0-9.]/g, ''))} />
            </div>
          </div>
          <div style={grid2}>
            <div className="form-field">
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>TDS ৳</span>
                {touched.tds && (
                  <a href="#auto" onClick={e => { e.preventDefault(); resetAuto('tds'); }} style={{ fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><RotateCcw size={11} /> auto</a>
                )}
              </label>
              <input className="form-input" inputMode="decimal" value={form.tds} onChange={e => { setTouched(t => ({ ...t, tds: true })); set('tds', e.target.value.replace(/[^0-9.]/g, '')); }} />
            </div>
            <div className="form-field">
              <label style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>VDS ৳</span>
                {touched.vds && (
                  <a href="#auto" onClick={e => { e.preventDefault(); resetAuto('vds'); }} style={{ fontSize: '11.5px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><RotateCcw size={11} /> auto</a>
                )}
              </label>
              <input className="form-input" inputMode="decimal" value={form.vds} onChange={e => { setTouched(t => ({ ...t, vds: true })); set('vds', e.target.value.replace(/[^0-9.]/g, '')); }} />
            </div>
          </div>

          <div style={sectionTitle}>Signed invoice &amp; collection</div>
          <div style={grid3}>
            <div className="form-field">
              <label>Signed invoice submitted to ACNABIN</label>
              <YesNo value={form.signedSubmitted} onChange={v => set('signedSubmitted', v)} />
            </div>
            <div className="form-field">
              <label>Mail date</label>
              <input type="date" className="form-input" value={form.mailDate} onChange={e => setForm(f => ({ ...f, mailDate: e.target.value, signedSubmitted: e.target.value ? 'Yes' : f.signedSubmitted }))} />
            </div>
            <div />
          </div>
          <div style={grid3}>
            <div className="form-field">
              <label>Collection status</label>
              <YesNo value={form.collected} onChange={v => set('collected', v)} />
            </div>
            <div className="form-field">
              <label>Collection date</label>
              <input type="date" className="form-input" value={form.collectionDate} onChange={e => setForm(f => ({ ...f, collectionDate: e.target.value, collected: e.target.value ? 'Yes' : f.collected }))} />
            </div>
            <div className="form-field">
              <label>Collection method</label>
              <input className="form-input" list="inv-methods" value={form.collectionMethod} onChange={e => set('collectionMethod', e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label>Cheque number / Transaction reference</label>
            <input className="form-input" value={form.paymentRef} onChange={e => set('paymentRef', e.target.value)} />
          </div>

          <div style={sectionTitle}>VDS collection</div>
          <div style={grid2}>
            <div className="form-field">
              <label>VDS collection status</label>
              <YesNo value={form.vdsCollected} onChange={v => set('vdsCollected', v)} />
            </div>
            <div className="form-field">
              <label>VDS collection date</label>
              <input type="date" className="form-input" value={form.vdsDate} onChange={e => setForm(f => ({ ...f, vdsDate: e.target.value, vdsCollected: e.target.value ? 'Yes' : f.vdsCollected }))} />
            </div>
          </div>
          <div style={grid2}>
            <div className="form-field">
              <label>Existing Drive link (old data)</label>
              <input className="form-input" placeholder="https://drive.google.com/…" value={form.vdsChallanLink} onChange={e => set('vdsChallanLink', e.target.value)} />
            </div>
            <div className="form-field">
              <label>VDS challan number</label>
              <input className="form-input" placeholder="e.g. 2526-00224626851" value={form.vdsChallanNo} onChange={e => set('vdsChallanNo', e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label>Attach VDS challan files (saved to Drive after you save)</label>
            <input type="file" multiple disabled={!driveUrl} onChange={e => { pickFiles('VDS', e.target.files); e.target.value = ''; }} />
            {!driveUrl && <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: '3px' }}>Admin has not set the Drive upload link yet.</div>}
            {queued.VDS.length > 0 && (
              <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                {queued.VDS.map((f, n) => (
                  <div key={n}>
                    {f.name} <a href="#rm" onClick={e => { e.preventDefault(); setQueued(q => ({ ...q, VDS: q.VDS.filter((_, k) => k !== n) })); }} style={{ color: '#B91C1C' }}>remove</a>
                  </div>
                ))}
              </div>
            )}
            {editingId && filesOf(editingId, 'VDS').length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '3px' }}>{filesOf(editingId, 'VDS').length} file(s) already attached. Manage them from the Challan copy column.</div>
            )}
          </div>

          <div style={sectionTitle}>TDS collection</div>
          <div style={grid2}>
            <div className="form-field">
              <label>TDS collection status</label>
              <YesNo value={form.tdsCollected} onChange={v => set('tdsCollected', v)} />
            </div>
            <div className="form-field">
              <label>TDS collection date</label>
              <input type="date" className="form-input" value={form.tdsDate} onChange={e => setForm(f => ({ ...f, tdsDate: e.target.value, tdsCollected: e.target.value ? 'Yes' : f.tdsCollected }))} />
            </div>
          </div>
          <div style={grid2}>
            <div className="form-field">
              <label>Existing Drive link (old data)</label>
              <input className="form-input" placeholder="https://drive.google.com/…" value={form.tdsChallanLink} onChange={e => set('tdsChallanLink', e.target.value)} />
            </div>
            <div className="form-field">
              <label>TDS challan number</label>
              <input className="form-input" placeholder="e.g. 2526-00485927061" value={form.tdsChallanNo} onChange={e => set('tdsChallanNo', e.target.value)} />
            </div>
          </div>
          <div className="form-field">
            <label>Attach TDS challan files (saved to Drive after you save)</label>
            <input type="file" multiple disabled={!driveUrl} onChange={e => { pickFiles('TDS', e.target.files); e.target.value = ''; }} />
            {!driveUrl && <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: '3px' }}>Admin has not set the Drive upload link yet.</div>}
            {queued.TDS.length > 0 && (
              <div style={{ fontSize: '12.5px', marginTop: '4px' }}>
                {queued.TDS.map((f, n) => (
                  <div key={n}>
                    {f.name} <a href="#rm" onClick={e => { e.preventDefault(); setQueued(q => ({ ...q, TDS: q.TDS.filter((_, k) => k !== n) })); }} style={{ color: '#B91C1C' }}>remove</a>
                  </div>
                ))}
              </div>
            )}
            {editingId && filesOf(editingId, 'TDS').length > 0 && (
              <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '3px' }}>{filesOf(editingId, 'TDS').length} file(s) already attached. Manage them from the Challan copy column.</div>
            )}
          </div>

          <div style={sectionTitle}>Notes</div>
          <div className="form-field">
            <label>Remarks</label>
            <textarea className="form-input" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div className="form-field">
            <label>ERP entry completed and reviewed with Director (with date)</label>
            <input className="form-input" value={form.erpNote} onChange={e => set('erpNote', e.target.value)} />
          </div>

          {fileNote && <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)', marginTop: '8px' }}>{fileNote}</div>}
          {formError && <div className="auth-alert-error" style={{ marginTop: '10px' }}>{formError}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving || dupNumber}>{saving ? 'Saving…' : editingId ? 'Save changes' : 'Add invoice'}</button>
        </div>
      </Modal>

      {toast && (
        <div style={{ position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', background: '#111', color: '#fff', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', zIndex: 10000 }}>{toast}</div>
      )}
    </div>
  );
};
