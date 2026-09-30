import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { TaskRequest } from '../../types';

interface Props {
  request: TaskRequest;
  status: 'ACCEPTED' | 'DECLINED';
  busy: boolean;
  onClose: () => void;
  onConfirm: (remarks: string) => void;
}

export const RespondRequestModal: React.FC<Props> = ({ request, status, busy, onClose, onConfirm }) => {
  const [remarks, setRemarks] = useState('');
  const accepting = status === 'ACCEPTED';

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={() => !busy && onClose()}
    >
      <div style={{ background: '#fff', borderRadius: '10px', width: '100%', maxWidth: '460px', boxShadow: '0 20px 40px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div className="banner-strip banner-maroon" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>{accepting ? 'ACCEPT TASK REQUEST' : 'DECLINE TASK REQUEST'}</span>
          <button type="button" onClick={onClose} disabled={busy} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '13px' }}>
            <strong>{request.requesterName}</strong> asked: <em>{request.particular}</em>
          </div>
          <div className="form-field">
            <label style={{ fontSize: '12px', fontWeight: 700 }}>Remarks (optional)</label>
            <textarea
              className="form-input"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder={accepting ? 'e.g. Start with the October statements.' : 'e.g. Not possible this week, please ask again on Sunday.'}
              rows={3}
              maxLength={500}
              autoFocus
              style={{ fontSize: '13px', resize: 'vertical' }}
            />
            <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '3px' }}>
              {request.requesterName} will see this in the app and in the email.
            </div>
          </div>
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end', gap: '10px', background: '#F8FAFC' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={accepting ? 'btn btn-teal' : 'btn btn-danger'}
            onClick={() => onConfirm(remarks.trim())}
            disabled={busy}
            style={{ minWidth: '110px' }}
          >
            {accepting ? <Check size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} /> : <X size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
            {busy ? 'Saving…' : accepting ? 'Accept' : 'Decline'}
          </button>
        </div>
      </div>
    </div>
  );
};
