import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileUp, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { downloadProposalsExcel } from '../../lib/proposalsExcel';
import {
  daysLeft, isClosedStatus, isSubmittedGroup, PROPOSAL_STATUSES, PROPOSAL_TYPES, splitLinks, statusRank, STATUS_COLORS
} from '../../lib/proposals';
import { uploadQueue } from '../../lib/uploadQueue';
import { deleteFromDrive, MAX_FILE_BYTES, fmtSize } from '../../lib/driveFiles';
import { useLivePolling } from '../../lib/useLivePolling';
import { proposalService } from '../../services/proposalService';
import { Proposal, ProposalAttachment, ProposalPerson } from '../../types';
import { StatPills } from '../dashboard/StatPills';
import { Modal } from '../ui/Modal';
import { AssigneePicker } from './AssigneePicker';
import { FilesModal } from './FilesModal';
import { ProposalImport } from './ProposalImport';

type Form = Omit<Proposal, 'id'> & { assignedIds: string[] };
const EMPTY: Form = {
  name: '', client: '', type: 'Statutory Audit', assignedTo: '', assignedIds: [], receiveDate: '', deadline: '', status: 'Draft', remarks: ''
};

const fmtShort = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const Chip: React.FC<{ children: React.ReactNode; bg: string; fg: string }> = ({ children, bg, fg }) => (
  <span style={{ display: 'inline-block', padding: '2px 9px', borderRadius: '10px', fontSize: '11px', fontWeight: 600, background: bg, color: fg, whiteSpace: 'nowrap' }}>
    {children}
  </span>
);

const DaysChip: React.FC<{ iso: string }> = ({ iso }) => {
  const d = daysLeft(iso);
  if (d === null) return null;
  if (d < 0) return <Chip bg="#FEE2E2" fg="#991B1B">{-d} day{d === -1 ? '' : 's'} overdue</Chip>;
  if (d === 0) return <Chip bg="#FFEDD5" fg="#9A3412">Due today</Chip>;
  if (d <= 3) return <Chip bg="#FFEDD5" fg="#9A3412">{d} day{d === 1 ? '' : 's'} left</Chip>;
  return <Chip bg="#E5E7EB" fg="#374151">{d} days left</Chip>;
};

export const ProposalTracker: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [attachments, setAttachments] = useState<ProposalAttachment[]>([]);
  const [people, setPeople] = useState<ProposalPerson[]>([]);
  const [driveUrl, setDriveUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const [submittedOpen, setSubmittedOpen] = useState(false);
  const [filesFor, setFilesFor] = useState<Proposal | null>(null);
  const [readFor, setReadFor] = useState<Proposal | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [touchedAssignees, setTouchedAssignees] = useState(false);
  const [queued, setQueued] = useState<File[]>([]);
  const [fileNote, setFileNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(async () => {
    try {
      const [rows, files, ppl, url] = await Promise.all([
        proposalService.list(),
        proposalService.listAttachments().catch(() => [] as ProposalAttachment[]),
        proposalService.people().catch(() => [] as ProposalPerson[]),
        proposalService.getDriveUrl().catch(() => '')
      ]);
      const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
      setProposals(prev => (same(prev, rows) ? prev : rows));
      setAttachments(prev => (same(prev, files) ? prev : files));
      setPeople(prev => (same(prev, ppl) ? prev : ppl));
      setDriveUrl(url);
      setLoadError(null);
    } catch (e: any) {
      setLoadError(e?.message || 'Could not load proposals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, currentUser?.id]);

  useLivePolling(() => load(), 30000, !modalOpen && !importOpen);

  // A background upload finished: refresh the file counts
  useEffect(() => {
    const onFiles = () => void load();
    window.addEventListener('proposal-files-changed', onFiles);
    return () => window.removeEventListener('proposal-files-changed', onFiles);
  }, [load]);

  const counted = useMemo(() => proposals.filter(p => !isClosedStatus(p.status)), [proposals]); // Rejected is not counted anywhere
  const active = useMemo(
    () => counted.filter(p => !isSubmittedGroup(p.status)).sort((a, b) => statusRank(a.status) - statusRank(b.status)),
    [counted]
  );
  const submitted = useMemo(() => counted.filter(p => isSubmittedGroup(p.status)), [counted]);
  const closed = useMemo(() => proposals.filter(p => isClosedStatus(p.status)), [proposals]);
  const nearDeadline = useMemo(
    () =>
      active
        .filter(p => {
          const d = daysLeft(p.deadline);
          return d !== null && d >= 0 && d <= 3;
        })
        .sort((a, b) => (daysLeft(a.deadline) || 0) - (daysLeft(b.deadline) || 0)),
    [active]
  );

  const filesOf = (id: string) => attachments.filter(a => a.proposalId === id);
  const nameOf = (id: string) => people.find(p => p.id === id)?.name;

  const openModal = (p?: Proposal) => {
    setEditingId(p ? p.id : null);
    setForm(
      p
        ? { name: p.name, client: p.client, type: p.type || 'Statutory Audit', assignedTo: p.assignedTo, assignedIds: p.assignedIds || [], receiveDate: p.receiveDate, deadline: p.deadline, status: p.status, remarks: p.remarks }
        : EMPTY
    );
    setTouchedAssignees(false);
    setQueued([]);
    setFileNote(null);
    setFormError(null);
    setModalOpen(true);
  };

  const pickFiles = (list: FileList | null) => {
    if (!list) return;
    const ok: File[] = [];
    const bad: string[] = [];
    Array.from(list).forEach(f => (f.size === 0 || f.size > MAX_FILE_BYTES ? bad.push(f.name) : ok.push(f)));
    setFileNote(bad.length ? `Not added (empty or bigger than 100 MB): ${bad.join(', ')}` : null);
    if (ok.length) setQueued(q => [...q, ...ok]);
  };

  const save = async () => {
    if (!form.name.trim() || !form.client.trim()) {
      setFormError('Name and Client are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    const id = editingId || `p${Date.now()}`;
    const { assignedIds, ...rest } = form;
    try {
      // Step 1: save the proposal. Nothing waits for the files.
      await proposalService.save({
        id, ...rest, name: form.name.trim(), client: form.client.trim(),
        // old proposals keep their typed names until someone is picked
        ...(!editingId || touchedAssignees ? { assignedIds } : {})
      } as Partial<Proposal>);
    } catch (e: any) {
      setFormError(e?.message || 'Could not save.');
      setSaving(false);
      return;
    }
    setModalOpen(false);
    setSaving(false);
    showToast(editingId ? 'Changes saved' : 'Proposal added');
    if (!editingId || touchedAssignees) void proposalService.emailAssigned(id); // only people not emailed before get one
    // Step 2: the files go up in the background
    if (queued.length > 0) uploadQueue.add(driveUrl, id, form.client.trim(), queued);
    await load();
  };

  const changeStatus = async (p: Proposal, status: string) => {
    try {
      // assignedIds is left out on purpose: the people (or the old typed names) stay as they are
      const { assignedIds: _keep, ...rest } = p;
      await proposalService.save({ ...rest, status });
      showToast(isSubmittedGroup(status) ? `Moved to Submitted: ${p.name.slice(0, 40)}` : 'Status updated');
      await load();
    } catch (e: any) {
      showToast(e?.message || 'Could not change the status.');
    }
  };

  const remove = async (p: Proposal) => {
    if (!window.confirm(`Delete the proposal "${p.name}"? Its files are also removed from Google Drive. This cannot be undone.`)) return;
    try {
      for (const a of filesOf(p.id)) await deleteFromDrive(driveUrl, a.driveFileId);
      await proposalService.remove(p.id);
      showToast('Proposal deleted');
      await load();
    } catch (e: any) {
      showToast(e?.message || 'Could not delete.');
    }
  };

  const exportExcel = async () => {
    try {
      const rows = [...active, ...submitted].map(p => ({ p, files: filesOf(p.id).length, daysLeft: daysLeft(p.deadline) }));
      await downloadProposalsExcel(rows, `ACNABIN_Proposals_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      window.alert('Could not create the Excel file. Please try again.');
    }
  };

  const assignees = (p: Proposal): React.ReactNode => {
    const names = (p.assignedIds || []).map(nameOf).filter(Boolean) as string[];
    const list = names.length > 0 ? names : p.assignedTo ? p.assignedTo.split(',').map(s => s.trim()).filter(Boolean) : [];
    if (list.length === 0) return <span style={{ color: 'var(--ink-muted)' }}>—</span>;
    const linked = (p.assignedIds || []).length > 0;
    return (
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {list.map((n, i) => (
          <Chip key={i} bg={linked ? '#EBF0FE' : '#F1F5F9'} fg={linked ? 'var(--navy)' : '#475569'}>{n}</Chip>
        ))}
      </div>
    );
  };

  /** Remarks with clickable web links. wrap = full text (used in the read window), otherwise one line. */
  const remarksCell = (text: string, wrap = false) =>
    text ? (
      <span style={wrap ? { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' } : undefined}>
        {splitLinks(text).map((part, i) =>
          part.url ? (
            <a key={i} href={part.url} target="_blank" rel="noreferrer" title={part.url} onClick={e => e.stopPropagation()} style={{ fontWeight: 600 }}>
              {wrap
                ? part.url
                : (() => {
                    try {
                      return `${new URL(part.url).hostname.replace(/^www\./, '')} ↗`;
                    } catch {
                      return 'link ↗';
                    }
                  })()}
            </a>
          ) : (
            <React.Fragment key={i}>{part.text}</React.Fragment>
          )
        )}
      </span>
    ) : (
      <span style={{ color: 'var(--ink-muted)' }}>—</span>
    );

  const table = (rows: Proposal[], empty: string, withDays: boolean) => (
    <div className="table-responsive">
      <table className="data-table" style={{ minWidth: '1350px', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '44px' }} />
          <col style={{ width: '280px' }} />
          <col style={{ width: '110px' }} />
          <col style={{ width: '185px' }} />
          <col style={{ width: '175px' }} />
          <col style={{ width: '150px' }} />
          <col style={{ width: '110px' }} />
          <col style={{ width: '190px' }} />
          <col style={{ width: '104px' }} />
        </colgroup>
        <thead>
          <tr>
            <th style={{ textAlign: 'center' }}>SL</th>
            <th style={{ textAlign: 'center' }}>Proposal / Client</th>
            <th style={{ textAlign: 'center' }}>Type</th>
            <th style={{ textAlign: 'center' }}>Timeline</th>
            <th style={{ textAlign: 'center' }}>Assigned To</th>
            <th style={{ textAlign: 'center' }}>Status</th>
            <th style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>Attachment</th>
            <th style={{ textAlign: 'center' }}>Remarks</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} style={{ textAlign: 'center', padding: '30px', color: 'var(--ink-muted)', fontStyle: 'italic' }}>{empty}</td>
            </tr>
          ) : (
            rows.map((p, i) => {
              const n = filesOf(p.id).length;
              const sc = STATUS_COLORS[p.status] || { bg: '#E5E7EB', fg: '#374151' };
              return (
                <tr key={p.id}>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{i + 1}</td>
                  <td
                    onClick={() => setReadFor(p)}
                    title="Click to read the full name and remarks"
                    style={{ textAlign: 'left', cursor: 'pointer', overflow: 'hidden' }}
                  >
                    <div style={{ fontWeight: 600, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.client}</div>
                  </td>
                  <td style={{ textAlign: 'center', whiteSpace: 'normal' }}>{p.type || '—'}</td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ whiteSpace: 'nowrap', fontSize: '13px' }}>
                      {fmtShort(p.receiveDate)} <span style={{ color: 'var(--ink-muted)' }}>→</span> <strong>{fmtShort(p.deadline)}</strong>
                    </div>
                    {withDays && <div style={{ marginTop: '4px' }}><DaysChip iso={p.deadline} /></div>}
                  </td>
                  <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>{assignees(p)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <select
                      value={p.status}
                      onChange={e => void changeStatus(p, e.target.value)}
                      title="Change status"
                      style={{ background: sc.bg, color: sc.fg, border: 'none', borderRadius: '12px', padding: '4px 8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', maxWidth: '170px' }}
                    >
                      {PROPOSAL_STATUSES.map(s => (
                        <option key={s} value={s} style={{ background: '#fff', color: '#111' }}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {n > 0 ? (
                      <button className="btn btn-secondary btn-sm" onClick={() => setFilesFor(p)} title="View and download the files" style={{ padding: '3px 9px' }}>
                        <Paperclip size={13} /> {n}
                      </button>
                    ) : (
                      <span style={{ color: 'var(--ink-muted)' }}>—</span>
                    )}
                  </td>
                  <td
                    onClick={() => p.remarks && setReadFor(p)}
                    title={p.remarks ? 'Click to read the full remarks' : undefined}
                    style={{ textAlign: 'left', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: p.remarks ? 'pointer' : 'default' }}
                  >
                    {remarksCell(p.remarks)}
                  </td>
                  <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => openModal(p)} title="Edit" style={{ padding: '4px 8px' }}>
                      <Pencil size={13} />
                    </button>
                    {isAdmin && (
                      <button className="btn btn-secondary btn-sm" onClick={() => remove(p)} title="Delete (Admin)" style={{ padding: '4px 8px', marginLeft: '6px', color: '#B91C1C' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  const dueSoon = nearDeadline.length;
  const bannerBtn: React.CSSProperties = { height: '32px', padding: '0 14px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', borderRadius: '6px' };

  return (
    <div className="tab-pane">
      {loadError ? (
        <div className="auth-alert-error">{loadError}</div>
      ) : loading ? (
        <div className="loading-indicator">Loading proposals…</div>
      ) : (
        <>
          <StatPills
            variant="maroon"
            items={[
              { label: 'TOTAL', value: counted.length },
              { label: 'ACTIVE', value: active.length },
              { label: 'IN-PROGRESS', value: counted.filter(p => p.status === 'In Progress').length },
              { label: 'DUE SOON (0-3 DAYS)', value: dueSoon, isOverdue: dueSoon > 0 },
              { label: 'SUBMITTED', value: submitted.length, onClick: () => setSubmittedOpen(true), title: 'Click to see the submitted proposals' }
            ]}
          />

          <div className="table-card">
            <div className="banner-strip banner-teal" style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '0 14px' }}>
              <span />
              <span>ACTIVE PROPOSAL</span>
              <span style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                {isAdmin && (
                  <button className="btn btn-sm" style={{ ...bannerBtn, background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }} onClick={() => setImportOpen(true)}>
                    <FileUp size={14} /> Import
                  </button>
                )}
                <button className="btn btn-sm" style={{ ...bannerBtn, background: 'rgba(255,255,255,0.18)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)' }} onClick={exportExcel}>
                  <Download size={14} /> Excel
                </button>
                <button className="btn btn-sm" style={{ ...bannerBtn, background: '#fff', color: 'var(--teal-dark)', border: 'none' }} onClick={() => openModal()}>
                  <Plus size={14} /> New Proposal
                </button>
              </span>
            </div>
            {table(active, 'No active proposals', true)}
          </div>

          <div className="table-card">
            <div className="banner-strip banner-maroon">NEAR DEADLINE PROPOSAL</div>
            {table(nearDeadline, 'No near-deadline proposals', true)}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', margin: '4px 2px 12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} />
            Show closed proposals (Rejected): {closed.length}
          </label>
          {showClosed && (
            <div className="table-card">
              <div className="banner-strip banner-navy">CLOSED PROPOSALS (REJECTED)</div>
              {table(closed, 'No closed proposals', false)}
            </div>
          )}
        </>
      )}

      {/* Submitted proposals, like the completed tasks list */}
      <Modal isOpen={submittedOpen} onClose={() => setSubmittedOpen(false)} title={`Submitted Proposals (${submitted.length})`} maxWidth="1180px">
        <div style={{ padding: '0 0 6px' }}>{table(submitted, 'No submitted proposals yet', false)}</div>
      </Modal>

      {/* Full name and remarks of one proposal */}
      <Modal isOpen={Boolean(readFor)} onClose={() => setReadFor(null)} title="Proposal details" maxWidth="640px">
        {readFor && (
          <div className="modal-body">
            <div className="form-field">
              <label>Proposal</label>
              <div style={{ fontWeight: 600, fontSize: '14px', overflowWrap: 'anywhere' }}>{readFor.name}</div>
            </div>
            <div className="form-field">
              <label>Client</label>
              <div style={{ overflowWrap: 'anywhere' }}>{readFor.client}</div>
            </div>
            <div className="form-field">
              <label>Remarks</label>
              <div style={{ fontSize: '13.5px', lineHeight: 1.5 }}>{remarksCell(readFor.remarks, true)}</div>
            </div>
          </div>
        )}
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => { const p = readFor; setReadFor(null); if (p) openModal(p); }}>
            <Pencil size={13} /> Edit
          </button>
          <button className="btn btn-primary" onClick={() => setReadFor(null)}>Close</button>
        </div>
      </Modal>

      <FilesModal
        proposal={filesFor}
        files={filesFor ? filesOf(filesFor.id) : []}
        driveUrl={driveUrl}
        isAdmin={isAdmin}
        onClose={() => setFilesFor(null)}
        onChanged={() => void load()}
      />

      <Modal isOpen={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editingId ? 'Edit Proposal' : 'New Proposal'} maxWidth="580px">
        <div className="modal-body">
          <div className="form-field">
            <label>Proposal name</label>
            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Client</label>
            <input className="form-input" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} />
          </div>
          <div className="form-field">
            <label>Assigned to (they get an email)</label>
            <AssigneePicker
              people={people}
              value={form.assignedIds}
              legacyText={form.assignedIds.length === 0 ? form.assignedTo : ''}
              onChange={ids => {
                setForm({ ...form, assignedIds: ids });
                setTouchedAssignees(true);
              }}
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-field">
              <label>Receive date</label>
              <input type="date" className="form-input" value={form.receiveDate} onChange={e => setForm({ ...form, receiveDate: e.target.value })} />
            </div>
            <div className="form-field">
              <label>Deadline</label>
              <input type="date" className="form-input" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-field">
              <label>Type</label>
              <select className="form-select" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {(PROPOSAL_TYPES.includes(form.type) || !form.type ? PROPOSAL_TYPES : [form.type, ...PROPOSAL_TYPES]).map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Status</label>
              <select className="form-select" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {PROPOSAL_STATUSES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-field">
            <label>Remarks</label>
            <textarea className="form-textarea" rows={3} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
          </div>

          <div className="form-field">
            <label>Attachments</label>
            <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)' }}>TOR, tender notice, PDF, image, doc … up to 100 MB each. They upload to Google Drive after the proposal is saved.</div>
            {!driveUrl ? (
              <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', padding: '8px 10px' }}>
                File upload is not set up yet. Ask Admin to add the Drive upload link (Admin Panel → Proposal Tracker Access).
              </div>
            ) : (
              <>
                {editingId && filesOf(editingId).length > 0 && (
                  <button type="button" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setFilesFor(proposals.find(p => p.id === editingId) || null)}>
                    <Paperclip size={13} /> {filesOf(editingId).length} saved file{filesOf(editingId).length === 1 ? '' : 's'}: view / download
                  </button>
                )}
                {queued.map((f, i) => (
                  <div key={`${f.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', border: '1px solid var(--line)', borderRadius: '6px', background: '#EFF6FF', fontSize: '12.5px' }}>
                    <Paperclip size={14} color="var(--navy)" />
                    <span style={{ flex: 1, overflowWrap: 'anywhere' }}>{f.name}</span>
                    <span style={{ color: 'var(--ink-muted)' }}>{fmtSize(f.size)}</span>
                    <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '2px 8px' }} onClick={() => setQueued(q => q.filter((_, idx) => idx !== i))}>×</button>
                  </div>
                ))}
                <input type="file" multiple onChange={e => { pickFiles(e.target.files); e.target.value = ''; }} />
                {fileNote && <div style={{ fontSize: '12px', color: '#B91C1C' }}>{fileNote}</div>}
              </>
            )}
          </div>

          {formError && <div className="auth-alert-error" style={{ margin: 0 }}>{formError}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add proposal'}
          </button>
        </div>
      </Modal>

      <ProposalImport isOpen={importOpen} onClose={() => setImportOpen(false)} onDone={() => void load()} />

      {toast && (
        <div style={{ position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', background: 'var(--ink)', color: '#fff', padding: '10px 18px', borderRadius: '8px', fontSize: '13px', zIndex: 2000 }}>
          {toast}
        </div>
      )}
    </div>
  );
};
