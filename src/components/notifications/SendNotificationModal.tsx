import React, { useMemo, useState } from 'react';
import { Send, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { notificationService } from '../../services/notificationService';

type Audience = 'ALL' | 'STD' | 'EMP' | 'ONE';
type Kind = 'MESSAGE' | 'INFO' | 'SALARY';

const segStyle = (active: boolean, isGlass?: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '8px 10px',
  fontSize: '12.5px',
  fontWeight: 700,
  borderRadius: '6px',
  cursor: 'pointer',
  border: isGlass
    ? (active ? '1px solid rgba(246, 139, 139, 0.45)' : '1px solid rgba(255, 255, 255, 0.15)')
    : ('1px solid ' + (active ? 'var(--maroon, #800000)' : 'var(--line)')),
  background: isGlass
    ? (active ? 'rgba(246, 139, 139, 0.22)' : 'rgba(255, 255, 255, 0.06)')
    : (active ? 'var(--maroon, #800000)' : '#ffffff'),
  color: isGlass
    ? (active ? '#fca5a5' : '#ffffff')
    : (active ? '#ffffff' : 'var(--ink)')
});

interface Props {
  onClose: () => void;
  onSent: () => void;
}

export const SendNotificationModal: React.FC<Props> = ({ onClose, onSent }) => {
  const { currentUser, allUsers } = useAuth();
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';
  const [audience, setAudience] = useState<Audience>('ALL');
  const [kind, setKind] = useState<Kind>('MESSAGE');
  const [userId, setUserId] = useState('');
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const choices = useMemo(
    () =>
      allUsers
        .filter(u => u.status === 'ACTIVE' && u.id !== currentUser?.id && u.role !== 'ADMIN')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allUsers, currentUser]
  );

  const handleSend = async () => {
    setNote(null);
    if (audience === 'ONE' && !userId) return setNote({ ok: false, text: 'Please select a user.' });
    if (kind === 'MESSAGE' && !text.trim()) return setNote({ ok: false, text: 'Please type your message.' });
    const who = audience === 'STD' ? 'all active STUDENTS (STD)' : audience === 'EMP' ? 'all active EMPLOYEES (EMP)' : 'ALL active users';
    const confirmText =
      kind === 'INFO'
        ? `Send an "update your information" request to ${who}?`
        : kind === 'SALARY'
          ? `Send a "salary & conveyance" update request to ${who}?`
          : `Send this message to ${who}?`;
    if (audience !== 'ONE' && !window.confirm(confirmText)) return;

    setSending(true);
    try {
      const target = audience === 'ONE' ? userId : undefined;
      const group = audience === 'STD' || audience === 'EMP' ? audience : undefined;
      const { count } =
        kind === 'INFO'
          ? await notificationService.sendInfoRequest(target, group)
          : kind === 'SALARY'
            ? await notificationService.sendInfoRequest(target, group, 'SALARY')
            : await notificationService.sendAnnouncement(text.trim(), target, group);
      if (kind === 'MESSAGE') setText('');
      setNote({ ok: true, text: `Sent to ${count} user${count === 1 ? '' : 's'}.` });
      onSent();
    } catch (e: any) {
      setNote({ ok: false, text: e?.message || 'Could not send.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      onClick={() => !sending && onClose()}
    >
      <div
        className="modal-dialog"
        style={{
          background: isGlass ? 'var(--ui-modal-bg)' : '#fff',
          borderRadius: '10px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '92vh',
          overflowY: 'auto',
          boxShadow: isGlass ? 'var(--ui-shadow)' : '0 20px 40px rgba(0,0,0,0.25)',
          border: isGlass ? '1px solid var(--ui-border)' : undefined,
          backdropFilter: isGlass ? 'var(--ui-blur)' : undefined,
          WebkitBackdropFilter: isGlass ? 'var(--ui-blur)' : undefined,
          color: isGlass ? '#ffffff' : undefined
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="banner-strip banner-maroon" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 18px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700 }}>SEND NOTIFICATION</span>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: isGlass ? '#ffffff' : undefined }}>Send to</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" style={segStyle(audience === 'ALL', isGlass)} onClick={() => setAudience('ALL')}>All users</button>
              <button type="button" style={segStyle(audience === 'STD', isGlass)} onClick={() => setAudience('STD')}>Students (STD)</button>
              <button type="button" style={segStyle(audience === 'EMP', isGlass)} onClick={() => setAudience('EMP')}>Employees (EMP)</button>
              <button type="button" style={segStyle(audience === 'ONE', isGlass)} onClick={() => setAudience('ONE')}>Individual</button>
            </div>
          </div>

          {audience === 'ONE' && (
            <select className="form-select" value={userId} onChange={e => setUserId(e.target.value)} style={{ height: '36px', fontSize: '13px' }}>
              <option value="">Select a user…</option>
              {choices.map(u => (
                <option key={u.id} value={u.id}>{u.name} ({u.empId})</option>
              ))}
            </select>
          )}

          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px', color: isGlass ? '#ffffff' : undefined }}>Type</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button type="button" style={segStyle(kind === 'MESSAGE', isGlass)} onClick={() => setKind('MESSAGE')}>Custom message</button>
              <button type="button" style={segStyle(kind === 'INFO', isGlass)} onClick={() => setKind('INFO')}>Update info request</button>
              <button type="button" style={segStyle(kind === 'SALARY', isGlass)} onClick={() => setKind('SALARY')}>Salary &amp; conveyance only</button>
            </div>
            <div style={{ fontSize: '11.5px', color: isGlass ? 'rgba(255, 255, 255, 0.70)' : 'var(--ink-muted)', marginTop: '6px' }}>
              {kind === 'MESSAGE'
                ? 'A plain notification, e.g. "Attend team meeting". Users just read it.'
                : kind === 'SALARY'
                  ? 'Asks only for monthly salary/allowance and daily conveyance, showing their current values. Stays unread until they submit.'
                  : 'Asks for academic year, salary/allowance, daily conveyance, blood group and emergency contact. Stays unread until they submit.'}
            </div>
          </div>

          {kind === 'MESSAGE' && (
            <textarea
              className="form-input"
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Type your message, e.g. Submit your timesheet by 5 PM."
              rows={3}
              style={{ fontSize: '13px', resize: 'vertical' }}
            />
          )}

          {note && (
            <div
              className={note.ok ? undefined : 'auth-alert-error'}
              style={{ margin: 0, fontSize: '12.5px', color: note.ok ? (isGlass ? '#77dfc0' : '#166534') : undefined, fontWeight: note.ok ? 600 : undefined }}
            >
              {note.text}
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 16px',
          borderTop: isGlass ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '10px',
          background: isGlass ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC'
        }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={sending}
            style={{
              background: isGlass ? 'rgba(255, 255, 255, 0.10)' : undefined,
              color: isGlass ? '#ffffff' : undefined,
              border: isGlass ? '1px solid rgba(255, 255, 255, 0.20)' : undefined
            }}
          >
            Close
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSend} disabled={sending} style={{ minWidth: '110px' }}>
            <Send size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
};
