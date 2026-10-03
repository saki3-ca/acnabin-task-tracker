import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserMultiPicker } from './UserMultiPicker';

interface Props {
  title: string;
  icon: React.ReactNode;
  description: string;
  load: () => Promise<string[]>;
  save: (ids: string[]) => Promise<void>;
  children?: React.ReactNode;
}

/** One "who can see this tab" card: search dropdown + chips + Save. Admin always has every tab. */
export const TabAccessCard: React.FC<Props> = ({ title, icon, description, load, save, children }) => {
  const { allUsers } = useAuth();
  const [ids, setIds] = useState<string[]>([]);
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    load()
      .then(list => {
        setIds(list);
        setSaved([...list].sort().join(','));
      })
      .catch(e => setMsg({ ok: false, text: e?.message || 'Could not load the list.' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const people = useMemo(
    () => allUsers.filter(u => u.role !== 'ADMIN' && u.status === 'ACTIVE').sort((a, b) => a.name.localeCompare(b.name)),
    [allUsers]
  );

  const dirty = [...ids].sort().join(',') !== saved;

  const onSave = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await save(ids);
      setSaved([...ids].sort().join(','));
      setMsg({ ok: true, text: 'Saved.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="table-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--navy)' }}>
        {icon} {title}
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px', marginBottom: '14px' }}>{description}</p>
      {children}
      <UserMultiPicker users={people} selectedIds={ids} onChange={setIds} />
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={onSave} disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save access'}
        </button>
        <span style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>{ids.length} with access</span>
        {msg && <span style={{ fontSize: '12.5px', color: msg.ok ? '#166534' : '#B91C1C' }}>{msg.text}</span>}
      </div>
    </div>
  );
};
