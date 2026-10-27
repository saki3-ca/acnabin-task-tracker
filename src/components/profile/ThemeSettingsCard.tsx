import React, { useEffect, useRef, useState } from 'react';
import { Check, Moon, Palette, Sun } from 'lucide-react';
import { useAppTheme } from '../../context/ThemeContext';
import { AppTheme } from '../../services/appThemeService';

const OPTIONS: { id: AppTheme; label: string; note: string; Icon: typeof Sun }[] = [
  { id: 'classic', label: 'Light', note: 'Warm cream pages, crisp white cards', Icon: Sun },
  { id: 'glass', label: 'Dark', note: 'Frosted glass panels on a soft gradient', Icon: Moon }
];

/** "Theme settings" button for the profile header; opens a small menu with Light (Classic) and Dark (Glass). */
export const ThemeSettingsCard: React.FC = () => {
  const { theme, setPersonalTheme } = useAppTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Choose how the tracker looks for you"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 16px', fontSize: '12px', fontWeight: 600, borderRadius: '6px', border: '1.5px solid var(--line-strong)', background: 'var(--ui-surface)', color: 'var(--ink)', cursor: 'pointer' }}
      >
        <Palette size={13} /> Theme settings
      </button>
      {open && (
        <div
          role="menu"
          style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 50, width: '250px', padding: '6px', borderRadius: '10px', background: 'var(--ui-modal-bg)', border: '1px solid var(--ui-border-strong)', boxShadow: 'var(--ui-shadow)', backdropFilter: 'var(--ui-blur)', WebkitBackdropFilter: 'var(--ui-blur)' }}
        >
          {OPTIONS.map(({ id, label, note, Icon }) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={theme === id}
              onClick={() => { setPersonalTheme(id); setOpen(false); }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left', padding: '9px 10px', border: 'none', borderRadius: '8px', background: theme === id ? 'var(--ui-table-row-hover)' : 'transparent', color: 'var(--ink)', cursor: 'pointer' }}
            >
              <Icon size={16} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '13px', fontWeight: 700 }}>{label}</span>
                <span style={{ display: 'block', fontSize: '11px', color: 'var(--ink-soft)' }}>{note}</span>
              </span>
              {theme === id && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
