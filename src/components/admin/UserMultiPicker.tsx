import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { User } from '../../types';

interface Props {
  users: User[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

/** Search-and-pick dropdown with the chosen people shown as removable chips. */
export const UserMultiPicker: React.FC<Props> = ({ users, selectedIds, onChange, placeholder = 'Search a name or ID to add…' }) => {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const byId = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    return users
      .filter(u => !s || u.name.toLowerCase().includes(s) || (u.empId || '').toLowerCase().includes(s) || (u.designation || '').toLowerCase().includes(s))
      .slice(0, 50);
  }, [users, q]);

  const toggle = (id: string) => onChange(selected.has(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]);

  return (
    <div ref={box} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--ink-muted)' }} />
        <input
          className="form-input"
          value={q}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={e => {
            setQ(e.target.value);
            setOpen(true);
          }}
          style={{ paddingLeft: '30px', width: '100%' }}
        />
      </div>

      {open && (
        <div
          style={{
            position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, zIndex: 30, background: '#fff',
            border: '1px solid var(--line)', borderRadius: 8, boxShadow: '0 10px 24px rgba(0,0,0,0.15)', maxHeight: 260, overflowY: 'auto'
          }}
        >
          {matches.length === 0 && <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--ink-muted)' }}>No matching users.</div>}
          {matches.map(u => (
            <div
              key={u.id}
              onClick={() => toggle(u.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 13,
                background: selected.has(u.id) ? '#EBF0FE' : '#fff', borderBottom: '1px solid #F1F1F1'
              }}
            >
              <span style={{ width: 16, display: 'flex' }}>{selected.has(u.id) && <Check size={14} color="var(--navy)" />}</span>
              <span style={{ fontWeight: 600 }}>{u.name}</span>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--ink-soft)' }}>{u.designation} · {u.empId}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
        {selectedIds.length === 0 && <span style={{ fontSize: 12.5, color: 'var(--ink-muted)' }}>Nobody added yet.</span>}
        {selectedIds.map(id => {
          const u = byId.get(id);
          return (
            <span
              key={id}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 6px 4px 10px', borderRadius: 14, background: '#EBF0FE', border: '1px solid var(--navy)', fontSize: 12.5, fontWeight: 600, color: 'var(--navy)' }}
            >
              {u ? u.name : id}
              <button type="button" onClick={() => toggle(id)} title="Remove" style={{ display: 'flex', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--navy)', padding: 0 }}>
                <X size={13} />
              </button>
            </span>
          );
        })}
      </div>
    </div>
  );
};
