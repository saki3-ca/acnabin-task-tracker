import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { ProposalPerson } from '../../types';

interface Props {
  people: ProposalPerson[];
  value: string[];
  onChange: (ids: string[]) => void;
  /** Old proposals only have a typed name ("E-GP"); shown as a hint until someone is picked */
  legacyText?: string;
}

/** Pick one or more people (only people who have access to the tracker). */
export const AssigneePicker: React.FC<Props> = ({ people, value, onChange, legacyText }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const chosen = value.map(id => people.find(p => p.id === id)).filter((p): p is ProposalPerson => Boolean(p));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(v => v !== id) : [...value, id]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="form-select"
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', textAlign: 'left', minHeight: '38px', cursor: 'pointer' }}
      >
        {chosen.length === 0 ? (
          <span style={{ color: 'var(--ink-muted)', flex: 1 }}>Select people…</span>
        ) : (
          <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
            {chosen.map(p => (
              <span key={p.id} style={{ background: '#EBF0FE', color: 'var(--navy)', borderRadius: '10px', padding: '1px 8px', fontSize: '12px', fontWeight: 600 }}>
                {p.name}
              </span>
            ))}
          </span>
        )}
        <ChevronDown size={14} />
      </button>
      {legacyText && chosen.length === 0 && (
        <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)', marginTop: '3px' }}>
          Currently written as “{legacyText}”. Pick people to replace it.
        </div>
      )}
      {open && (
        <div
          style={{
            position: 'absolute', zIndex: 20, left: 0, right: 0, top: 'calc(100% + 4px)', background: '#fff', border: '1px solid var(--line)',
            borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: '240px', overflowY: 'auto'
          }}
        >
          {people.length === 0 ? (
            <div style={{ padding: '12px', fontSize: '12.5px', color: 'var(--ink-muted)' }}>
              No one has access to the Proposal Tracker yet. Admin can give access in the Admin Panel.
            </div>
          ) : (
            people.map(p => {
              const on = value.includes(p.id);
              return (
                <button
                  type="button"
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%', padding: '8px 12px', border: 'none',
                    background: on ? '#EBF0FE' : '#fff', cursor: 'pointer', textAlign: 'left', fontSize: '13px'
                  }}
                >
                  <span style={{ width: '16px', height: '16px', borderRadius: '4px', border: `1.5px solid ${on ? 'var(--navy)' : 'var(--line-strong)'}`, background: on ? 'var(--navy)' : '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
                    {on && <Check size={11} />}
                  </span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: on ? 600 : 500 }}>{p.name}</span>
                    <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-muted)' }}>{p.designation}</span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
