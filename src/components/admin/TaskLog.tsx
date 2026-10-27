import React, { useCallback, useEffect, useState } from 'react';
import { History, RefreshCw } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { TaskHistoryEntry, taskHistoryService } from '../../services/taskHistoryService';

const fmtWhen = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const shorten = (v?: string | null) => {
  const t = (v ?? '').trim();
  if (!t) return '—';
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
};

/** Admin only: who changed which task, when, and what it was before. */
export const TaskLog: React.FC = () => {
  const { allUsers } = useAuth();
  const [userId, setUserId] = useState('');
  const [onlyStatus, setOnlyStatus] = useState(true);
  const [rows, setRows] = useState<TaskHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await taskHistoryService.get({ userId: userId || undefined, onlyStatus }));
    } catch (e: any) {
      setRows(null);
      setError(e?.message || 'Could not load the task log.');
    } finally {
      setLoading(false);
    }
  }, [userId, onlyStatus]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="table-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--navy)' }}>
            <History size={18} /> Task Log
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', marginTop: '4px' }}>
            Every task created, changed or deleted, newest first. Changes made before the log was switched on are not here.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <select className="form-select" value={userId} onChange={e => setUserId(e.target.value)} style={{ minWidth: '190px' }}>
            <option value="">Everyone</option>
            {[...allUsers].sort((a, b) => a.name.localeCompare(b.name)).map(u => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600 }}>
            <input type="checkbox" checked={onlyStatus} onChange={e => setOnlyStatus(e.target.checked)} />
            Status changes only
          </label>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={13} /> {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="auth-alert-error" style={{ marginTop: '14px' }}>{error}</div>}

      {rows && (
        <div className="table-responsive" style={{ marginTop: '14px' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', whiteSpace: 'nowrap' }}>When</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Task</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Assigned to</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>What happened</th>
                <th style={{ textAlign: 'left', padding: '10px 12px' }}>Changed by</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-muted)' }}>Nothing logged yet.</td></tr>
              ) : rows.map(r => (
                <tr key={r.id}>
                  <td style={{ padding: '9px 12px', whiteSpace: 'nowrap' }}>{fmtWhen(r.changed_at)}</td>
                  <td style={{ padding: '9px 12px' }}>
                    <div style={{ fontWeight: 600 }}>{shorten(r.particular)}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)' }}>{r.clientName || '—'}</div>
                  </td>
                  <td style={{ padding: '9px 12px' }}>{r.assignedToName || '—'}</td>
                  <td style={{ padding: '9px 12px' }}>
                    {r.action === 'CREATED' && <span>Task created</span>}
                    {r.action === 'DELETED' && <span>Task deleted</span>}
                    {r.action === 'UPDATED' && Object.entries(r.changes).map(([field, c]) => (
                      <div key={field}>
                        <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{field}</span>: {shorten(c.from)} → <b>{shorten(c.to)}</b>
                      </div>
                    ))}
                  </td>
                  <td style={{ padding: '9px 12px' }}>{r.changedByName || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
