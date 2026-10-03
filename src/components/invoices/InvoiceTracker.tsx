import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, ExternalLink, Paperclip, Pencil, Plus, Receipt, RotateCcw, Search, Trash2 } from 'lucide-react';
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
  amount: '', tds: '', vds: '', clientSubmitted: 'No', clientSubmitDate: '', signedSubmitted: 'No', mailDate: '', collected: 'No', collectionDate: '', collectionMethod: '', paymentRef: '',
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

type Group = 'inv' | 'amt' | 'sub' | 'col' | 'vds' | 'tds' | 'note';
// Soft tinted look (same family as the Profile counters): background, border, text and the header underline per group
const GROUPS: Record<Group, { label: string; bg: string; border: string; fg: string; accent: string }> = {
  inv: { label: 'Invoice', bg: '#EFF6FF', border: '#BFDBFE', fg: '#1E40AF', accent: '#2563EB' },
  amt: { label: 'Amount', bg: '#F0FDF4', border: '#86EFAC', fg: '#166534', accent: '#16A34A' },
  sub: { label: 'Submission', bg: '#FFFBEB', border: '#FDE68A', fg: '#92400E', accent: '#D97706' },
  col: { label: 'Collection', bg: '#F0FDFA', border: '#99F6E4', fg: '#0F766E', accent: '#0D9488' },
  vds: { label: 'VDS', bg: '#FAF5FF', border: '#E9D5FF', fg: '#6B21A8', accent: '#7C3AED' },
  tds: { label: 'TDS', bg: '#FEF2F2', border: '#FECACA', fg: '#991B1B', accent: '#DC2626' },
  note: { label: 'Notes', bg: '#F8FAFC', border: '#CBD5E1', fg: '#334155', accent: '#64748B' }
};
const TITLE_GREEN = '#146860';
// Order of the column groups (the table and the legend follow it)
const GROUP_ORDER: Group[] = ['amt', 'inv', 'sub', 'tds', 'vds', 'col', 'note'];
interface Col {
  key: string;
  head: string;
  w: number;
  group: Group;
  align: 'left' | 'center' | 'right';
  sticky?: 'left' | 'right';
  left?: number;
  render: (i: Invoice, n: number) => React.ReactNode;
}

const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' };
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', alignItems: 'end' };

/** One tinted mini card of the New Invoice form; its colour matches the column group in the table legend. */
const FormCard: React.FC<{ group: Group; title: string; hint?: string; children: React.ReactNode }> = ({ group, title, hint, children }) => (
  <div style={{ background: GROUPS[group].bg, border: `1px solid ${GROUPS[group].border}`, borderLeft: `4px solid ${GROUPS[group].accent}`, borderRadius: '10px', padding: '12px 16px 6px', marginBottom: '12px' }}>
    <div style={{ fontSize: '13.5px', fontWeight: 700, color: GROUPS[group].fg }}>{title}</div>
    {hint && <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '8px' }}>{hint}</div>}
    {children}
  </div>
);

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
  const [show, setShow] = useState<'ALL' | 'NOSUB' | 'OUT' | 'COL'>('ALL');
  const [clientFilter, setClientFilter] = useState('');

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
    let collected = 0;
    let vdsPending = 0;
    let tdsPending = 0;
    invoices.forEach(i => {
      if (isYes(i.collected)) collected += 1;
      if (!isYes(i.vdsCollected) && toNum(i.vds) > 0) vdsPending += 1;
      if (!isYes(i.tdsCollected) && toNum(i.tds) > 0) tdsPending += 1;
    });
    return { collected, outstanding: invoices.length - collected, vdsPending, tdsPending };
  }, [invoices]);

  const rows = useMemo(() => {
    const q = norm(search);
    return invoices.filter(i => {
      if (clientFilter && i.client !== clientFilter) return false;
      if (show === 'NOSUB' && isYes(i.clientSubmitted)) return false;
      if (show === 'OUT' && isYes(i.collected)) return false;
      if (show === 'COL' && !isYes(i.collected)) return false;
      if (!q) return true;
      return [i.client, i.invoiceNo, i.submissionNo, i.jobNumber, i.jicName, i.purpose, i.forMonth].some(v => norm(v || '').includes(q));
    });
  }, [invoices, search, show, clientFilter]);
  const hasActiveFilters = Boolean(search.trim() || clientFilter || show !== 'ALL');
  const clearFilters = () => {
    setSearch('');
    setClientFilter('');
    setShow('ALL');
  };
  const clientsInTable = useMemo(() => [...new Set(invoices.map(i => i.client).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [invoices]);

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

  const cell = (v: string) => (v ? <span title={v}>{v}</span> : <span style={{ color: 'var(--ink-muted)' }}>—</span>);
  const dateCell = (iso: string) => <span style={{ color: iso ? undefined : 'var(--ink-muted)' }}>{fmtDate(iso)}</span>;
  const baseCols: Col[] = [
    { key: 'sl', head: 'SL', w: 46, group: 'inv', align: 'center', sticky: 'left', left: 0, render: (_i, n) => <strong>{n + 1}</strong> },
    {
      key: 'client', head: 'Client Name', w: 250, group: 'inv', align: 'left', sticky: 'left', left: 46,
      render: i => <span title={i.client} style={{ fontWeight: 600 }}>{i.client}</span>
    },
    { key: 'jic', head: 'JIC Name', w: 150, group: 'inv', align: 'left', render: i => cell(i.jicName) },
    { key: 'month', head: 'For the Month', w: 130, group: 'inv', align: 'center', render: i => cell([i.forMonth, i.year].filter(Boolean).join(' ')) },
    { key: 'idate', head: 'Invoice Date', w: 112, group: 'inv', align: 'center', render: i => dateCell(i.invoiceDate) },
    { key: 'job', head: 'Job No.', w: 90, group: 'inv', align: 'center', render: i => cell(i.jobNumber) },
    { key: 'purpose', head: 'Purpose', w: 160, group: 'inv', align: 'left', render: i => cell(i.purpose) },
    { key: 'ino', head: 'Invoice No.', w: 190, group: 'inv', align: 'center', render: i => <strong style={{ fontSize: '12.5px' }}>{i.invoiceNo}</strong> },
    { key: 'sno', head: 'Submission No.', w: 112, group: 'inv', align: 'center', render: i => cell(i.submissionNo) },

    { key: 'amt', head: 'Invoice Amount (৳)', w: 132, group: 'amt', align: 'right', render: i => <strong>{money(i.amount)}</strong> },
    { key: 'tds', head: 'TDS (৳)', w: 100, group: 'amt', align: 'right', render: i => money(i.tds) },
    { key: 'vds', head: 'VDS (৳)', w: 100, group: 'amt', align: 'right', render: i => money(i.vds) },

    { key: 'csub', head: 'Submitted to Client', w: 124, group: 'sub', align: 'center', render: i => <Chip value={i.clientSubmitted} /> },
    { key: 'csubd', head: 'Client Submission Date', w: 150, group: 'sub', align: 'center', render: i => dateCell(i.clientSubmitDate) },
    {
      key: 'signed', head: 'Signed Invoice Mail to ACNABIN', w: 168, group: 'sub', align: 'center',
      // Yes = the mail date (or a small "Yes" when no date was entered); No = blank
      render: i => (isYes(i.signedSubmitted) ? (i.mailDate ? dateCell(i.mailDate) : <Chip value="Yes" />) : null)
    },

    { key: 'cstat', head: 'Collection Status', w: 112, group: 'col', align: 'center', render: i => <Chip value={i.collected} /> },
    { key: 'cdate', head: 'Collection Date', w: 112, group: 'col', align: 'center', render: i => dateCell(i.collectionDate) },
    { key: 'cmeth', head: 'Collection Method', w: 128, group: 'col', align: 'center', render: i => cell(i.collectionMethod) },
    { key: 'cref', head: 'Cheque / Transaction Ref.', w: 200, group: 'col', align: 'center', render: i => cell(i.paymentRef) },

    { key: 'vstat', head: 'VDS Status', w: 92, group: 'vds', align: 'center', render: i => <Chip value={i.vdsCollected} /> },
    { key: 'vdate', head: 'VDS Collection Date', w: 148, group: 'vds', align: 'center', render: i => dateCell(i.vdsDate) },
    { key: 'vfile', head: 'VDS Challan Copy', w: 116, group: 'vds', align: 'center', render: i => challanCell(i, 'VDS') },
    { key: 'vno', head: 'VDS Challan No.', w: 170, group: 'vds', align: 'center', render: i => cell(i.vdsChallanNo) },

    { key: 'tstat', head: 'TDS Status', w: 92, group: 'tds', align: 'center', render: i => <Chip value={i.tdsCollected} /> },
    { key: 'tdate', head: 'TDS Collection Date', w: 148, group: 'tds', align: 'center', render: i => dateCell(i.tdsDate) },
    { key: 'tfile', head: 'TDS Challan Copy', w: 116, group: 'tds', align: 'center', render: i => challanCell(i, 'TDS') },
    { key: 'tno', head: 'TDS Challan No.', w: 170, group: 'tds', align: 'center', render: i => cell(i.tdsChallanNo) },

    { key: 'rem', head: 'Remarks', w: 230, group: 'note', align: 'left', render: i => cell(i.remarks) },
    { key: 'erp', head: 'ERP Entry / Director Review', w: 210, group: 'note', align: 'left', render: i => cell(i.erpNote) },
    {
      key: 'act', head: '', w: 92, group: 'note', align: 'center', sticky: 'right',
      render: i => (
        <span style={{ whiteSpace: 'nowrap' }}>
          {rowBtn('Edit', () => openModal(i), <Pencil size={13} />)}
          {isAdmin && rowBtn('Delete (Admin)', () => void remove(i), <Trash2 size={13} />, '#B91C1C', 6)}
        </span>
      )
    }
  ];
  const cols: Col[] = [...baseCols].sort((a, b) => {
    const rank = (c: Col) => (c.key === 'sl' ? -2 : c.key === 'client' ? -1 : GROUP_ORDER.indexOf(c.group));
    return rank(a) - rank(b);
  });
  const totalWidth = cols.reduce((sum, c) => sum + c.w, 0);
  const stickyStyle = (c: Col, head: boolean): React.CSSProperties =>
    c.sticky === 'left'
      ? { position: 'sticky', left: c.left, zIndex: head ? 5 : 2, boxShadow: c.key === 'client' ? '2px 0 4px rgba(0,0,0,0.08)' : undefined }
      : c.sticky === 'right'
      ? { position: 'sticky', right: 0, zIndex: head ? 5 : 2, boxShadow: '-2px 0 4px rgba(0,0,0,0.08)' }
      : {};

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
              { label: 'COLLECTED', value: stats.collected },
              { label: 'OUTSTANDING', value: stats.outstanding, isOverdue: stats.outstanding > 0 },
              { label: 'VDS PENDING', value: stats.vdsPending, isOverdue: stats.vdsPending > 0 },
              { label: 'TDS PENDING', value: stats.tdsPending, isOverdue: stats.tdsPending > 0 }
            ]}
          />

          <div
            className="filter-bar"
            style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '12px 18px', borderRadius: '8px', border: '1px solid var(--line)' }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1 }}>
              <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 240px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)' }} />
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '32px', height: '36px', fontSize: '12.5px', width: '100%' }}
                  placeholder="Search client, invoice no., job no., JIC…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div style={{ minWidth: '200px', flex: '1 1 220px' }}>
                <select className="form-select" style={{ height: '36px', fontSize: '12.5px', width: '100%' }} value={clientFilter} onChange={e => setClientFilter(e.target.value)}>
                  <option value="">All Clients</option>
                  {clientsInTable.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div style={{ minWidth: '190px', flex: '1 1 190px' }}>
                <select className="form-select" style={{ height: '36px', fontSize: '12.5px', width: '100%' }} value={show} onChange={e => setShow(e.target.value as 'ALL' | 'NOSUB' | 'OUT' | 'COL')}>
                  <option value="ALL">All Invoices</option>
                  <option value="NOSUB">Not submitted to client</option>
                  <option value="OUT">Not collected yet</option>
                  <option value="COL">Collected</option>
                </select>
              </div>
              {hasActiveFilters && (
                <button type="button" onClick={clearFilters} className="btn btn-secondary btn-sm" style={{ height: '36px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }} title="Reset all filters">
                  <RotateCcw size={13} /> Reset
                </button>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--ink-soft)', fontWeight: 600 }}>
              Showing {rows.length} of {invoices.length} invoice{invoices.length === 1 ? '' : 's'}
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            {/* the legend sits in the gap above the title bar, so the space between filter bar and table stays the same as Manpower */}
            <div style={{ position: 'absolute', right: '2px', bottom: '100%', marginBottom: '7px', display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {GROUP_ORDER.map(g => (
                  <span
                    key={g}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '1px 9px', borderRadius: '10px', background: GROUPS[g].bg, border: `1px solid ${GROUPS[g].border}`, color: GROUPS[g].fg, fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px' }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: GROUPS[g].accent, display: 'inline-block' }} />
                    {GROUPS[g].label}
                  </span>
                ))}
              </div>
            </div>
          <div className="table-card" style={{ marginBottom: 0 }}>
            <div className="banner-strip" style={{ justifyContent: 'center', padding: '0 16px', background: TITLE_GREEN, color: '#fff' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Receipt size={16} />
                <span>INVOICES</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'absolute', right: '16px' }}>
                <button
                  type="button"
                  onClick={exportExcel}
                  style={{ background: 'rgba(255, 255, 255, 0.95)', color: TITLE_GREEN, border: 'none', padding: '3px 10px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                  title="Export to Excel"
                >
                  <Download size={12} /> Export Excel
                </button>
                <button
                  type="button"
                  onClick={() => openModal()}
                  style={{ background: '#ffffff', color: TITLE_GREEN, border: 'none', padding: '3px 10px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}
                >
                  <Plus size={12} /> New Invoice
                </button>
              </div>
            </div>

            <div className="table-responsive" style={{ minHeight: '440px', maxHeight: '70vh' }}>
              <table className="data-table" style={{ minWidth: `${totalWidth}px`, tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
                <colgroup>
                  {cols.map(c => (
                    <col key={c.key} style={{ width: `${c.w}px` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {cols.map(c => (
                      <th key={c.key} title={c.head} style={{ ...stickyStyle(c, true), textAlign: 'center', background: GROUPS[c.group].bg, color: GROUPS[c.group].fg, whiteSpace: 'normal', lineHeight: 1.25, padding: '10px 6px', fontSize: '11px', borderTop: 'none', borderBottom: `2px solid ${GROUPS[c.group].accent}`, borderRight: `1px solid ${GROUPS[c.group].border}`, position: 'sticky', top: 0, zIndex: c.sticky ? 4 : 3 }}>
                        {c.head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={cols.length} style={{ textAlign: 'center', padding: '30px', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
                        {invoices.length === 0 ? 'No invoices yet. Click “New Invoice” to add the first one.' : 'No invoices match.'}
                      </td>
                    </tr>
                  ) : (
                    rows.map((i, n) => (
                      <tr key={i.id}>
                        {cols.map(c => (
                          <td key={c.key} style={{ ...stickyStyle(c, false), textAlign: c.align, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', background: '#fff', borderBottom: '1px solid var(--line)', padding: '8px 8px' }}>
                            {c.render(i, n)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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

          <FormCard group="inv" title="Invoice" hint="Who it is for, and the invoice and submission numbers.">
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
          </FormCard>
          <FormCard group="amt" title="Amount" hint="Suggested automatically from the invoice amount. You can change any figure.">
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
          </FormCard>
          <FormCard group="sub" title="Submission" hint="Submitted to the client, and the signed invoice mailed to ACNABIN.">
          <div style={grid3}>
            <div className="form-field">
              <label>Submission status (Client)</label>
              <YesNo value={form.clientSubmitted} onChange={v => set('clientSubmitted', v)} />
            </div>
            <div className="form-field">
              <label>Client submission date</label>
              <input type="date" className="form-input" value={form.clientSubmitDate} onChange={e => setForm(f => ({ ...f, clientSubmitDate: e.target.value, clientSubmitted: e.target.value ? 'Yes' : f.clientSubmitted }))} />
            </div>
            <div />
          </div>
          <div style={grid3}>
            <div className="form-field">
              <label>Signed invoice submitted to ACNABIN</label>
              <YesNo value={form.signedSubmitted} onChange={v => set('signedSubmitted', v)} />
            </div>
            <div className="form-field">
              <label>Mail date (mailed to ACNABIN)</label>
              <input type="date" className="form-input" value={form.mailDate} onChange={e => setForm(f => ({ ...f, mailDate: e.target.value, signedSubmitted: e.target.value ? 'Yes' : f.signedSubmitted }))} />
            </div>
            <div />
          </div>
          </FormCard>
          <FormCard group="tds" title="TDS collection" hint="TDS status, date, challan copy and number.">
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
          </FormCard>
          <FormCard group="vds" title="VDS collection" hint="VDS status, date, challan copy and number.">
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
          </FormCard>
          <FormCard group="col" title="Collection" hint="Payment received from the client.">
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
          </FormCard>
          <FormCard group="note" title="Notes" hint="Remarks and the ERP entry.">
          <div className="form-field">
            <label>Remarks</label>
            <textarea className="form-input" rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} style={{ resize: 'vertical' }} />
          </div>
          <div className="form-field">
            <label>ERP entry completed and reviewed with Director (with date)</label>
            <input className="form-input" value={form.erpNote} onChange={e => set('erpNote', e.target.value)} />
          </div>
          </FormCard>
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
