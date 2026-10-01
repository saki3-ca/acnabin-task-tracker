import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FileUp, Paperclip, Pencil, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { daysLeft, isClosedStatus, PROPOSAL_STATUSES, PROPOSAL_TYPES, statusRank, STATUS_COLORS } from '../../lib/proposals';
import { useLivePolling } from '../../lib/useLivePolling';
import { proposalService } from '../../services/proposalService';
import { Proposal, ProposalAttachment } from '../../types';
import { deleteFromDrive, uploadToDrive } from '../../lib/driveFiles';
import { StatPills } from '../dashboard/StatPills';
import { Modal } from '../ui/Modal';
import { ProposalAttachments } from './ProposalAttachments';
import { ProposalImport } from './ProposalImport';

const EMPTY: Omit<Proposal, 'id'> = {
  name: '', client: '', type: 'Statutory Audit', assignedTo: '', receiveDate: '', deadline: '', status: 'Draft', remarks: ''
};

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const c = STATUS_COLORS[status] || { bg: '#E5E7EB', fg: '#374151' };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap', background: c.bg, color: c.fg }}>
      {status}
    </span>
  );
};

const DaysCell: React.FC<{ iso: string }> = ({ iso }) => {
  const d = daysLeft(iso);
  if (d === null) return <>—</>;
  const urgent = d <= 3;
  return <span style={{ fontWeight: urgent ? 700 : 500, color: d < 0 ? '#B91C1C' : urgent ? '#C2410C' : 'inherit' }}>{d}</span>;
};

export const ProposalTracker: React.FC = () => {
  const { currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showClosed, setShowClosed] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Omit<Proposal, 'id'>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  // Attachments (files live in Google Drive)
  const [attachments, setAttachments] = useState<ProposalAttachment[]>([]);
  const [driveUrl, setDriveUrl] = useState('');
  const [queued, setQueued] = useState<File[]>([]);
  const [progress, setProgress] = useState<Record<number, number>>({});

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const load = useCallback(async () => {
    try {
      const [rows, files, url] = await Promise.all([
        proposalService.list(),
        proposalService.listAttachments().catch(() => [] as ProposalAttachment[]),
        proposalService.getDriveUrl().catch(() => '')
      ]);
      setProposals(prev => (JSON.stringify(prev) === JSON.stringify(rows) ? prev : rows));
      setAttachments(prev => (JSON.stringify(prev) === JSON.stringify(files) ? prev : files));
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

  const active = useMemo(
    () => proposals.filter(p => !isClosedStatus(p.status)).sort((a, b) => statusRank(a.status) - statusRank(b.status)),
    [proposals]
  );
  const closed = useMemo(() => proposals.filter(p => isClosedStatus(p.status)), [proposals]);
  const nearDeadline = useMemo(
    () =>
      active
        .filter(p => p.status !== 'Submitted')
        .filter(p => {
          const d = daysLeft(p.deadline);
          return d !== null && d >= 0 && d <= 3;
        })
        .sort((a, b) => statusRank(a.status) - statusRank(b.status) || (daysLeft(a.deadline) || 0) - (daysLeft(b.deadline) || 0)),
    [active]
  );

  const openModal = (p?: Proposal) => {
    setEditingId(p ? p.id : null);
    setForm(p ? { name: p.name, client: p.client, type: p.type || 'Statutory Audit', assignedTo: p.assignedTo, receiveDate: p.receiveDate, deadline: p.deadline, status: p.status, remarks: p.remarks } : EMPTY);
    setFormError(null);
    setQueued([]);
    setProgress({});
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.client.trim()) {
      setFormError('Name and Client are required.');
      return;
    }
    setSaving(true);
    setFormError(null);
    // a new proposal gets its id here, so the files can be linked to it straight after saving
    const id = editingId || `p${Date.now()}`;
    try {
      await proposalService.save({ id, ...form, name: form.name.trim(), client: form.client.trim() });
    } catch (e: any) {
      setFormError(e?.message || 'Could not save.');
      setSaving(false);
      return;
    }

    // The proposal is saved. Now upload the files to Drive (Attachment / client / file).
    const failed: string[] = [];
    for (let i = 0; i < queued.length; i++) {
      const f = queued[i];
      try {
        const up = await uploadToDrive(driveUrl, form.client.trim(), f, frac => setProgress(p => ({ ...p, [i]: frac })));
        await proposalService.addAttachment({
          proposalId: id, fileName: up.name, mime: f.type || '', size: f.size, driveFileId: up.driveFileId, clientFolder: up.clientFolder
        });
      } catch (e: any) {
        failed.push(`${f.name} (${e?.message || 'failed'})`);
      }
    }
    await load();
    setSaving(false);
    setQueued([]);
    setProgress({});
    if (failed.length === 0) {
      setModalOpen(false);
      showToast(editingId ? 'Changes saved' : 'Proposal added');
    } else {
      // keep the form open on the saved proposal so the files can be tried again
      setEditingId(id);
      setFormError(`The proposal was saved, but these files did not upload: ${failed.join('; ')}. Add them again and press Save changes.`);
    }
  };

  const remove = async (p: Proposal) => {
    if (!window.confirm(`Delete the proposal "${p.name}"? This cannot be undone.`)) return;
    try {
      // files are removed from Drive first, then the proposal (its file list goes with it)
      for (const a of attachments.filter(x => x.proposalId === p.id)) {
        await deleteFromDrive(driveUrl, a.driveFileId);
      }
      await proposalService.remove(p.id);
      showToast('Proposal deleted');
      await load();
    } catch (e: any) {
      showToast(e?.message || 'Could not delete.');
    }
  };

  const rowActions = (p: Proposal) => (
    <td style={{ whiteSpace: 'nowrap' }}>
      <button className="btn btn-secondary btn-sm" onClick={() => openModal(p)} title="Edit" style={{ padding: '4px 8px' }}>
        <Pencil size={13} />
      </button>
      {isAdmin && (
        <button className="btn btn-secondary btn-sm" onClick={() => remove(p)} title="Delete (Admin)" style={{ padding: '4px 8px', marginLeft: '6px', color: '#B91C1C' }}>
          <Trash2 size={13} />
        </button>
      )}
    </td>
  );

  const dueSoon = active.filter(p => {
    const d = daysLeft(p.deadline);
    return d !== null && d >= 0 && d <= 3;
  }).length;

  const clip = (id: string) => {
    const n = attachments.filter(a => a.proposalId === id).length;
    return n > 0 ? (
      <span title={`${n} attachment${n > 1 ? 's' : ''}`} style={{ marginLeft: '8px', color: 'var(--navy)', fontSize: '12px', whiteSpace: 'nowrap' }}>
        <Paperclip size={12} style={{ verticalAlign: 'middle' }} /> {n}
      </span>
    ) : null;
  };

  const wrapCell: React.CSSProperties = { textAlign: 'left', whiteSpace: 'normal', overflowWrap: 'anywhere' };

  const fullTable = (rows: Proposal[], empty: string) => (
    <div className="table-responsive">
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: '44px' }}>SL</th><th>Name</th><th>Client</th><th>Type</th><th>Receive Date</th>
            <th>Deadline</th><th>Days Left</th><th>Assigned To</th><th>Status</th><th>Remarks</th><th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={11} style={{ textAlign: 'center', padding: '28px', color: 'var(--ink-muted)', fontStyle: 'italic' }}>{empty}</td></tr>
          ) : (
            rows.map((p, i) => (
              <tr key={p.id}>
                <td style={{ textAlign: 'center', fontWeight: 600 }}>{i + 1}</td>
                <td style={{ ...wrapCell, fontWeight: 500, minWidth: '180px' }}>{p.name}{clip(p.id)}</td>
                <td style={{ ...wrapCell, minWidth: '150px' }}>{p.client}</td>
                <td>{p.type || '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.receiveDate)}</td>
                <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.deadline)}</td>
                <td style={{ textAlign: 'center' }}><DaysCell iso={p.deadline} /></td>
                <td>{p.assignedTo || '—'}</td>
                <td><StatusBadge status={p.status} /></td>
                <td style={{ ...wrapCell, minWidth: '140px' }}>{p.remarks || '—'}</td>
                {rowActions(p)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="tab-pane">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '20px', color: 'var(--maroon)' }}>Proposal Tracker</h2>
          <div style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>Everyone with access sees all proposals. Only Admin can delete.</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {isAdmin && (
            <button className="btn btn-secondary" onClick={() => setImportOpen(true)}>
              <FileUp size={14} /> Import from Sheet
            </button>
          )}
          <button className="btn btn-primary" onClick={() => openModal()}>
            <Plus size={14} /> New Proposal
          </button>
        </div>
      </div>

      {loadError ? (
        <div className="auth-alert-error">{loadError}</div>
      ) : loading ? (
        <div className="loading-indicator">Loading proposals…</div>
      ) : (
        <>
          <StatPills
            variant="maroon"
            items={[
              { label: 'ACTIVE PROPOSAL', value: active.length },
              { label: 'TOTAL PROPOSAL', value: proposals.length },
              { label: 'SUBMITTED PROPOSAL', value: proposals.filter(p => p.status === 'Submitted').length },
              { label: 'IN-PROGRESS', value: proposals.filter(p => p.status === 'In Progress').length },
              { label: 'DUE SOON (0-3 DAYS)', value: dueSoon, isOverdue: dueSoon > 0 }
            ]}
          />

          <div className="table-card">
            <div className="banner-strip banner-teal">ACTIVE TENDERS</div>
            {fullTable(active, 'No active proposals')}
          </div>

          <div className="table-card">
            <div className="banner-strip banner-maroon">NEAR DEADLINE TASK</div>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '44px' }}>SL</th><th>Name</th><th>Client</th><th>Type</th><th>Deadline</th>
                    <th>Days Left</th><th>Assigned To</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {nearDeadline.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '28px', color: 'var(--ink-muted)', fontStyle: 'italic' }}>No near-deadline tasks</td></tr>
                  ) : (
                    nearDeadline.map((p, i) => (
                      <tr key={p.id}>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ ...wrapCell, fontWeight: 500, minWidth: '180px' }}>{p.name}{clip(p.id)}</td>
                        <td style={{ ...wrapCell, minWidth: '150px' }}>{p.client}</td>
                        <td>{p.type || '—'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.deadline)}</td>
                        <td style={{ textAlign: 'center' }}><DaysCell iso={p.deadline} /></td>
                        <td>{p.assignedTo || '—'}</td>
                        <td><StatusBadge status={p.status} /></td>
                        {rowActions(p)}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', margin: '4px 2px 12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={showClosed} onChange={e => setShowClosed(e.target.checked)} />
            Show closed proposals (Approved / Rejected): {closed.length}
          </label>
          {showClosed && (
            <div className="table-card">
              <div className="banner-strip banner-navy">CLOSED PROPOSALS</div>
              {fullTable(closed, 'No closed proposals')}
            </div>
          )}
        </>
      )}

      <Modal isOpen={modalOpen} onClose={() => !saving && setModalOpen(false)} title={editingId ? 'Edit Proposal' : 'New Proposal'} maxWidth="560px">
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
            <label>Assigned to</label>
            <input className="form-input" value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })} />
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
          <ProposalAttachments
            saved={editingId ? attachments.filter(a => a.proposalId === editingId) : []}
            queued={queued}
            onQueue={files => setQueued(q => [...q, ...files])}
            onUnqueue={i => setQueued(q => q.filter((_, idx) => idx !== i))}
            driveUrl={driveUrl}
            isAdmin={isAdmin}
            busy={saving}
            progress={progress}
            onChanged={() => void load()}
          />
          {formError && <div className="auth-alert-error" style={{ margin: 0 }}>{formError}</div>}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => setModalOpen(false)} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? (queued.length ? 'Saving & uploading…' : 'Saving…') : editingId ? 'Save changes' : 'Add proposal'}
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
