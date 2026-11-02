import React, { useMemo, useState } from 'react';
import { Send, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { ALL_INFO_FIELDS, INFO_FIELDS, InfoField } from '../../lib/infoRequestFields';
import { notificationService } from '../../services/notificationService';
import { UserMultiPicker } from '../admin/UserMultiPicker';

type Audience = 'ALL' | 'STD' | 'EMP' | 'ONE';
type Mode = 'MESSAGE' | 'REQUEST';

const AUDIENCES: { key: Audience; label: string }[] = [
  { key: 'ALL', label: 'Everyone' },
  { key: 'STD', label: 'Students' },
  { key: 'EMP', label: 'Employees' },
  { key: 'ONE', label: 'One person' }
];

const chip = (active: boolean, isGlass: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '8px 10px',
  fontSize: '12.5px',
  fontWeight: 700,
  borderRadius: '6px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  border: isGlass
    ? (active ? '1px solid rgba(246, 139, 139, 0.45)' : '1px solid rgba(255, 255, 255, 0.15)')
    : '1px solid ' + (active ? 'var(--maroon, #800000)' : 'var(--line)'),
  background: isGlass
    ? (active ? 'rgba(246, 139, 139, 0.22)' : 'rgba(255, 255, 255, 0.06)')
    : (active ? 'var(--maroon, #800000)' : '#ffffff'),
  color: isGlass ? (active ? '#fca5a5' : '#ffffff') : (active ? '#ffffff' : 'var(--ink)')
});

const Section: React.FC<{ title: string; children: React.ReactNode; aside?: React.ReactNode; isGlass: boolean }> = ({ title, children, aside, isGlass }) => (
  <div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
      <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: isGlass ? 'rgba(255, 255, 255, 0.75)' : 'var(--ink-soft)' }}>{title}</span>
      {aside}
    </div>
    {children}
  </div>
);

interface Props {
  onClose: () => void;
  onSent: () => void;
}

export const SendNotificationModal: React.FC<Props> = ({ onClose, onSent }) => {
  const { currentUser, allUsers } = useAuth();
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';
  const [audience, setAudience] = useState<Audience>('ALL');
  const [mode, setMode] = useState<Mode>('MESSAGE');
  const [userId, setUserId] = useState('');
  const [text, setText] = useState('');
  const [fields, setFields] = useState<InfoField[]>([]);
  const [excludeIds, setExcludeIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const choices = useMemo(
    () =>
      allUsers
        .filter(u => u.status === 'ACTIVE' && u.id !== currentUser?.id && u.role !== 'ADMIN')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [allUsers, currentUser]
  );

  const toggle = (key: InfoField) => setFields(f => (f.includes(key) ? f.filter(x => x !== key) : [...f, key]));

  const handleSend = async () => {
    setNote(null);
    if (audience === 'ONE' && !userId) return setNote({ ok: false, text: 'Please choose the person.' });
    if (mode === 'MESSAGE' && !text.trim()) return setNote({ ok: false, text: 'Please type your message.' });
    if (mode === 'REQUEST' && fields.length === 0) return setNote({ ok: false, text: 'Tick at least one thing to ask for.' });

    const except = audience !== 'ONE' && excludeIds.length > 0 ? ` except ${excludeIds.length} ${excludeIds.length === 1 ? 'person' : 'people'}` : '';
    const who = (audience === 'STD' ? 'all active students (STD)' : audience === 'EMP' ? 'all active employees (EMP)' : 'ALL active users') + except;
    const what =
      mode === 'MESSAGE'
        ? 'this message'
        : `an update request for: ${INFO_FIELDS.filter(f => fields.includes(f.key)).map(f => f.label).join(', ')}`;
    if (audience !== 'ONE' && !window.confirm(`Send ${what} to ${who}?`)) return;

    setSending(true);
    try {
      const target = audience === 'ONE' ? userId : undefined;
      const group = audience === 'STD' || audience === 'EMP' ? audience : undefined;
      const skip = audience === 'ONE' ? undefined : excludeIds;
      const { count } =
        mode === 'REQUEST'
          ? await notificationService.sendInfoRequest(target, group, fields, skip)
          : await notificationService.sendAnnouncement(text.trim(), target, group, skip);
      if (mode === 'MESSAGE') setText('');
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
          maxWidth: '540px',
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

        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <Section isGlass={isGlass} title="Send to">
            <div style={{ display: 'flex', gap: '8px' }}>
              {AUDIENCES.map(a => (
                <button key={a.key} type="button" style={chip(audience === a.key, isGlass)} onClick={() => setAudience(a.key)}>{a.label}</button>
              ))}
            </div>
            {audience !== 'ONE' && (
              <div style={{ marginTop: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px' }}>Except (optional)</div>
                <UserMultiPicker
                  users={choices}
                  selectedIds={excludeIds}
                  onChange={setExcludeIds}
                  placeholder="Search people to leave out…"
                />
              </div>
            )}
            {audience === 'ONE' && (
              <select className="form-select" value={userId} onChange={e => setUserId(e.target.value)} style={{ height: '36px', fontSize: '13px', marginTop: '8px', width: '100%' }}>
                <option value="">Choose a person…</option>
                {choices.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.empId})</option>
                ))}
              </select>
            )}
          </Section>

          <Section isGlass={isGlass} title="What to send">
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" style={chip(mode === 'MESSAGE', isGlass)} onClick={() => setMode('MESSAGE')}>Message</button>
              <button type="button" style={chip(mode === 'REQUEST', isGlass)} onClick={() => setMode('REQUEST')}>Ask to update information</button>
            </div>
          </Section>

          {mode === 'MESSAGE' ? (
            <Section isGlass={isGlass} title="Message">
              <textarea
                className="form-input"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="e.g. Submit your timesheet by 5 PM."
                rows={3}
                style={{ fontSize: '13px', resize: 'vertical', width: '100%' }}
              />
              <div style={{ fontSize: '11.5px', color: isGlass ? 'rgba(255, 255, 255, 0.70)' : 'var(--ink-muted)', marginTop: '6px' }}>A plain notification. People just read it.</div>
            </Section>
          ) : (
            <Section
              title="Ask them to update"
              aside={
                <span style={{ fontSize: '12px' }}>
                  <a href="#all" onClick={e => { e.preventDefault(); setFields(ALL_INFO_FIELDS); }}>Select all</a>
                  {' · '}
                  <a href="#none" onClick={e => { e.preventDefault(); setFields([]); }}>Clear</a>
                </span>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', border: isGlass ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--line)', borderRadius: '8px', overflow: 'hidden' }}>
                {INFO_FIELDS.map((f, i) => (
                  <label
                    key={f.key}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '9px 12px', cursor: 'pointer',
                      borderTop: i === 0 ? 'none' : isGlass ? '1px solid rgba(255, 255, 255, 0.10)' : '1px solid var(--line)',
                      background: fields.includes(f.key)
                        ? (isGlass ? 'rgba(246, 139, 139, 0.14)' : 'rgba(128, 0, 0, 0.05)')
                        : (isGlass ? 'rgba(255, 255, 255, 0.04)' : '#ffffff')
                    }}
                  >
                    <input type="checkbox" checked={fields.includes(f.key)} onChange={() => toggle(f.key)} style={{ marginTop: '3px' }} />
                    <span>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{f.label}</span>
                      {f.hint && <span style={{ display: 'block', fontSize: '11.5px', color: 'var(--ink-muted)' }}>{f.hint}</span>}
                    </span>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: '11.5px', color: isGlass ? 'rgba(255, 255, 255, 0.70)' : 'var(--ink-muted)', marginTop: '6px' }}>
                Tick one thing or several. The notification stays unread until they submit, and only the ticked fields are changed.
              </div>
            </Section>
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
