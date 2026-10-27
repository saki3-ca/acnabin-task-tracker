import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Mail, Phone, User as UserIcon } from 'lucide-react';
import { User } from '../../types';
import { useAppTheme } from '../../context/ThemeContext';

interface KeyPersonCellProps {
  primary?: User;
  secondary?: User;
}

/** Name that opens a small contact card (phone + email) when clicked. */
const PersonLink: React.FC<{ person: User; role: string; muted?: boolean }> = ({ person, role, muted }) => {
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: MouseEvent) => {
      if (cardRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setPos(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPos(null);
    const close = () => setPos(null);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [pos]);

  const toggle = () => {
    if (pos) return setPos(null);
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - 276)) });
  };

  const copy = (value: string, key: string) => {
    navigator.clipboard?.writeText(value).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 1200);
    }).catch(() => {});
  };

  const row = (icon: React.ReactNode, value: string | undefined, key: string, href: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', fontSize: '12.5px' }}>
      {icon}
      {value ? (
        <>
          <a href={href} style={{ flex: 1, color: isGlass ? '#c9a4eb' : 'var(--navy)', wordBreak: 'break-all' }}>{value}</a>
          <button
            type="button"
            onClick={() => copy(value, key)}
            title="Copy"
            aria-label={`Copy ${key}`}
            style={{ border: 'none', background: 'none', cursor: 'pointer', color: isGlass ? 'rgba(255, 255, 255, 0.65)' : 'var(--ink-muted)', padding: 2, display: 'inline-flex' }}
          >
            {copied === key ? <Check size={13} color={isGlass ? '#77dfc0' : '#03543F'} /> : <Copy size={13} />}
          </button>
        </>
      ) : (
        <span style={{ color: isGlass ? 'rgba(255, 255, 255, 0.50)' : 'var(--ink-muted)' }}>Not provided</span>
      )}
    </div>
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title={`${role} — click for contact info`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          border: 'none',
          background: 'none',
          padding: 0,
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: muted ? '11.5px' : '13px',
          fontWeight: muted ? 500 : 700,
          color: muted ? (isGlass ? 'rgba(255, 255, 255, 0.70)' : 'var(--ink-muted)') : (isGlass ? '#FFFFFF' : '#0F5E57')
        }}
      >
        {muted ? <span style={{ fontSize: '10px', textTransform: 'uppercase', color: isGlass ? 'rgba(255, 255, 255, 0.65)' : undefined }}>2nd</span> : <UserIcon size={13} color={isGlass ? '#77dfc0' : undefined} />}
        <span style={{ textDecoration: 'underline dotted' }}>{person.name}</span>
      </button>
      {pos && (
        <div
          ref={cardRef}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            width: '268px',
            zIndex: 1000,
            background: isGlass ? 'rgba(24, 28, 52, 0.95)' : '#fff',
            backdropFilter: isGlass ? 'blur(16px)' : undefined,
            WebkitBackdropFilter: isGlass ? 'blur(16px)' : undefined,
            border: isGlass ? '1px solid rgba(255, 255, 255, 0.20)' : '1px solid var(--border, #E2E8F0)',
            borderRadius: '8px',
            boxShadow: isGlass ? '0 12px 36px rgba(0,0,0,0.45)' : '0 8px 24px rgba(0,0,0,0.14)',
            padding: '10px 12px',
            textAlign: 'left',
            color: isGlass ? '#FFFFFF' : undefined
          }}
        >
          <div style={{ fontWeight: 700, color: isGlass ? '#FFFFFF' : 'var(--ink)', fontSize: '13px' }}>{person.name}</div>
          <div style={{ fontSize: '11px', color: isGlass ? 'rgba(255, 255, 255, 0.70)' : 'var(--ink-muted)', marginBottom: '6px' }}>
            {role}{person.designation ? ` · ${person.designation}` : ''}
          </div>
          <div style={{ borderTop: isGlass ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--border, #E2E8F0)', paddingTop: '4px' }}>
            {row(<Phone size={13} color={isGlass ? '#77dfc0' : 'var(--ink-soft)'} />, person.mobile, 'phone', `tel:${person.mobile}`)}
            {row(<Mail size={13} color={isGlass ? '#c9a4eb' : 'var(--ink-soft)'} />, person.email, 'email', `mailto:${person.email}`)}
          </div>
        </div>
      )}
    </>
  );
};

export const KeyPersonCell: React.FC<KeyPersonCellProps> = ({ primary, secondary }) => {
  if (!primary && !secondary) return <span style={{ color: 'var(--ink-muted)' }}>—</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}>
      {primary && <PersonLink person={primary} role="Key Person" />}
      {secondary && <PersonLink person={secondary} role="Secondary Key Person" muted />}
    </div>
  );
};
