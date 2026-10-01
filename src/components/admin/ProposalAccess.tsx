import React, { useEffect, useMemo, useState } from 'react';
import { FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { proposalService } from '../../services/proposalService';

/** Admin only: who gets the Proposal Tracker tab. Admin always has it. */
export const ProposalAccess: React.FC = () => {
  const { allUsers } = useAuth();
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<string>('');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    proposalService
      .getAccess()
      .then(ids => {
        setGranted(new Set(ids));
        setSaved([...ids].sort().join(','));
      })
      .catch(e => setMsg({ ok: false, text: e?.message || 'Could not load the access list.' }));
  }, []);

  const people = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUsers
      .filter(u => u.role !== 'ADMIN' && u.status === 'ACTIVE')
      .filter(u => !q || u.name.toLowerCase().includes(q) || (u.empId || '').toLowerCase().includes(q) || u.designation.toLowerCase().includes(q))
      .sort((a, b) => Number(granted.has(b.id)) - Number(granted.has(a.id)) || a.name.localeCompare(b.name));
  }, [allUsers, search, granted]);

  const toggle = (id: string) =>
    setGranted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const dirty = [...granted].sort().join(',') !== saved;

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await proposalService.setAccess([...granted]);
      setSaved([...granted].sort().join(','));
      setMsg({ ok: true, text: 'Access saved.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="table-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--navy)' }}>
        <FileText size={18} /> Proposal Tracker Access
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px', marginBottom: '14px' }}>
        Tick the people who should see the Proposal Tracker tab. Everyone with access can add and edit proposals. Only Admin can delete.
      </p>
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
        <input className="form-input" placeholder="Search name, ID or designation…" value={search} onChange={e => setSearch(e.target.value)} style={{ maxWidth: '300px' }} />
        <span style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>{granted.size} with access</span>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save access'}
        </button>
        {msg && <span style={{ fontSize: '12.5px', color: msg.ok ? '#166534' : '#B91C1C' }}>{msg.text}</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '8px', maxHeight: '320px', overflowY: 'auto' }}>
        {people.map(u => (
          <label
            key={u.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
              background: granted.has(u.id) ? '#EBF0FE' : '#FAF8F5', border: `1px solid ${granted.has(u.id) ? 'var(--navy)' : 'var(--line)'}`
            }}
          >
            <input type="checkbox" checked={granted.has(u.id)} onChange={() => toggle(u.id)} />
            <div>
              <div style={{ fontWeight: granted.has(u.id) ? 600 : 400 }}>{u.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{u.designation} · {u.empId}</div>
            </div>
          </label>
        ))}
        {people.length === 0 && <div style={{ fontSize: '13px', color: 'var(--ink-muted)' }}>No matching users.</div>}
      </div>
    </div>
  );
};
