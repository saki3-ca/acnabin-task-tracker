import React, { useState } from 'react';
import { CheckCheck, X } from 'lucide-react';
import { notificationService } from '../../services/notificationService';
import { UserQuery } from '../../types';

const formatTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

interface Props {
  queries: UserQuery[];
  error?: string;
  onChanged: () => void;
  onClose: () => void;
}

export const QueryInboxModal: React.FC<Props> = ({ queries, error: loadError, onChanged, onClose }) => {
  const [openId, setOpenId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolve = async (id: number) => {
    setBusy(true);
    setError(null);
    try {
      await notificationService.resolveQuery(id, note.trim());
      setOpenId(null);
      setNote('');
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Could not resolve.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={() => !busy && onClose()}
    >
      <div
        style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '620px', maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="banner-strip banner-maroon" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>USER QUERIES ({queries.length} OPEN)</span>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '14px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {queries.length === 0 && loadError && (
            <div className="auth-alert-error" style={{ margin: 0, fontSize: '12.5px' }}>{loadError}</div>
          )}
          {queries.length === 0 && !loadError && (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--ink-muted)', fontSize: '13px' }}>
              No open queries. 🎉
            </div>
          )}

          {queries.map(q => (
            <div key={q.id} style={{ border: '1px solid var(--line)', borderRadius: '8px', padding: '10px 12px', background: '#FFFDF9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--navy)' }}>
                  {q.userName} <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>({q.empId})</span>
                </span>
                <span style={{ fontSize: '11.5px', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>{formatTime(q.createdAt)}</span>
              </div>
              <div style={{ fontSize: '13px', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{q.message}</div>

              {openId === q.id ? (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <input
                    type="text"
                    className="form-input"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Optional note for the user…"
                    style={{ height: '34px', fontSize: '12.5px' }}
                  />
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpenId(null)} disabled={busy}>Cancel</button>
                    <button type="button" className="btn btn-teal btn-sm" onClick={() => resolve(q.id)} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                      <CheckCheck size={14} /> {busy ? 'Saving…' : 'Confirm resolve'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '8px', textAlign: 'right' }}>
                  <button
                    type="button"
                    className="btn btn-teal btn-sm"
                    onClick={() => {
                      setOpenId(q.id);
                      setNote('');
                      setError(null);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    <CheckCheck size={14} /> Resolve
                  </button>
                </div>
              )}
            </div>
          ))}

          {error && <div className="auth-alert-error" style={{ margin: 0 }}>{loadError}</div>}
        </div>
      </div>
    </div>
  );
};
