import React, { useEffect, useMemo, useState } from 'react';
import { BarChart3, Briefcase, FileText, GraduationCap, Lock, Receipt, Search, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { examLeaveService } from '../../services/examLeaveService';
import { invoiceService } from '../../services/invoiceService';
import { proposalService } from '../../services/proposalService';
import { tabAccessService } from '../../services/tabAccessService';
import { TabAccessEntry, TabAccessKey, TabAccessMode } from '../../types';
import { DriveLinkBox } from './DriveLinkBox';
import { UserMultiPicker } from './UserMultiPicker';

interface TabDef {
  key: TabAccessKey;
  title: string;
  icon: React.ReactNode;
  description: string;
  /** what applies while Admin has not chosen yet */
  defaultRule: string;
  /** shown when ALL is picked */
  warnAll?: string;
}

const TABS: TabDef[] = [
  {
    key: 'manpower', title: 'Manpower', icon: <Briefcase size={18} />,
    description: 'The staff directory by client. Salary and conveyance figures are only shown to Assistant Director and above, Admin and the people added under Individual.',
    defaultRule: 'Assistant Director and above see everything; In Charge to Manager see only their own clients (no money); plus the people added earlier.',
    warnAll: 'Everyone will see the Manpower tab: Assistant Director and above the full directory, the others only their own clients or the people list, without money.'
  },
  {
    key: 'firm_costing', title: 'Firm Costing', icon: <BarChart3 size={18} />,
    description: 'Client-wise revenue, cost and profit. Anyone who can open it also gets the salary figures it is built from.',
    defaultRule: 'Assistant Director and above.',
    warnAll: 'Everyone will see revenue, cost and profit for every client, and the salary figures behind them.'
  },
  {
    key: 'exam_leave', title: 'Exam Leave', icon: <GraduationCap size={18} />,
    description: 'ALL turns the tab on for everyone (use it in exam time), ADMIN turns it off for everyone. Each person still sees only their own client team; Assistant Directors and above see everyone.',
    defaultRule: 'The old on/off switch.'
  },
  {
    key: 'invoices', title: 'Invoices', icon: <Receipt size={18} />,
    description: 'People who can see the Invoices tab can add and edit invoices. Only Admin can delete.',
    defaultRule: 'Only the people added earlier.',
    warnAll: 'Everyone will see every invoice and can add and edit invoices.'
  },
  {
    key: 'proposals', title: 'Proposal Tracker', icon: <FileText size={18} />,
    description: 'People who can see the Proposal Tracker can add and edit proposals. Only Admin can delete.',
    defaultRule: 'Only the people added earlier.',
    warnAll: 'Everyone will see every proposal and can add and edit proposals.'
  },
  {
    key: 'tenders', title: 'Tender Agent', icon: <Search size={18} />,
    description: 'Bank, NGO and IT tender monitoring.',
    defaultRule: 'Only the people added earlier.'
  }
];

const MODES: { mode: TabAccessMode; label: string; hint: string }[] = [
  { mode: 'ALL', label: 'ALL', hint: 'Every active person' },
  { mode: 'ADMIN', label: 'ADMIN', hint: 'Only Admin' },
  { mode: 'INDIVIDUAL', label: 'Individual', hint: 'Admin and the people you pick' },
  { mode: 'EXCEPT', label: 'EXCEPT', hint: 'Everyone except the people you pick' },
  { mode: 'NONE', label: 'NONE', hint: 'Nobody, not even Admin: the tab is switched off' }
];

const sameIds = (a: string[], b: string[]) => [...a].sort().join(',') === [...b].sort().join(',');

interface CardProps {
  def: TabDef;
  saved: TabAccessEntry;
  onSaved: (entry: TabAccessEntry) => void;
  children?: React.ReactNode;
}

const TabCard: React.FC<CardProps> = ({ def, saved, onSaved, children }) => {
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';
  const { allUsers } = useAuth();
  const [mode, setMode] = useState<TabAccessMode | null>(saved.mode);
  const [ids, setIds] = useState<string[]>(saved.userIds);
  const [exceptIds, setExceptIds] = useState<string[]>(saved.exceptIds);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const people = useMemo(
    () => allUsers.filter(u => u.role !== 'ADMIN' && u.status === 'ACTIVE').sort((a, b) => a.name.localeCompare(b.name)),
    [allUsers]
  );

  // the list only matters (and is only saved) while Individual is chosen
  const dirty = mode !== saved.mode
    || (mode === 'INDIVIDUAL' && !sameIds(ids, saved.userIds))
    || (mode === 'EXCEPT' && !sameIds(exceptIds, saved.exceptIds));

  // who would have the tab with what is chosen now (Admin is not counted: Admin has it in every option except NONE)
  const counts = useMemo(() => {
    const total = people.length;
    const active = new Set(people.map(p => p.id));
    const inList = ids.filter(i => active.has(i)).length;
    const inExcept = exceptIds.filter(i => active.has(i)).length;
    if (mode === 'ALL') return { yes: total, no: 0 };
    if (mode === 'ADMIN' || mode === 'NONE') return { yes: 0, no: total };
    if (mode === 'INDIVIDUAL') return { yes: inList, no: total - inList };
    if (mode === 'EXCEPT') return { yes: total - inExcept, no: inExcept };
    return null;
  }, [mode, ids, exceptIds, people]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await tabAccessService.set(def.key, mode, mode === 'INDIVIDUAL' ? ids : undefined, mode === 'EXCEPT' ? exceptIds : undefined);
      onSaved({ mode, userIds: mode === 'INDIVIDUAL' ? ids : saved.userIds, exceptIds: mode === 'EXCEPT' ? exceptIds : saved.exceptIds });
      // unsaved edits to a list are dropped when another option is saved, so each list shows the remembered people
      if (mode !== 'INDIVIDUAL') setIds(saved.userIds);
      if (mode !== 'EXCEPT') setExceptIds(saved.exceptIds);
      setMsg({ ok: true, text: 'Saved. People see the change within a minute.' });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  const status = saved.mode === null ? 'Default rule' : saved.mode === 'INDIVIDUAL' ? `Individual (${saved.userIds.length})` : saved.mode === 'EXCEPT' ? `EXCEPT (${saved.exceptIds.length})` : saved.mode;
  const statusColor = saved.mode === 'ALL' ? '#166534' : saved.mode === 'ADMIN' || saved.mode === 'NONE' ? '#B91C1C' : saved.mode === 'INDIVIDUAL' ? 'var(--navy)' : 'var(--ink-muted)';

  return (
    <div className="table-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: isGlass ? '#FFFFFF' : 'var(--navy)', margin: 0 }}>
          {def.icon} {def.title}
        </h3>
        <span
          style={{
            fontSize: 11.5,
            fontWeight: 700,
            padding: '2px 10px',
            borderRadius: 12,
            border: isGlass ? '1px solid rgba(255, 255, 255, 0.20)' : '1px solid var(--line)',
            color: isGlass ? (saved.mode === 'ALL' ? '#77dfc0' : saved.mode === 'ADMIN' || saved.mode === 'NONE' ? '#f68b8b' : saved.mode === 'INDIVIDUAL' ? '#c9a4eb' : 'rgba(255, 255, 255, 0.85)') : statusColor,
            background: isGlass ? 'rgba(255, 255, 255, 0.08)' : '#FAF8F5'
          }}
        >
          {status}
        </span>
      </div>
      <p style={{ fontSize: '12px', color: isGlass ? 'rgba(255, 255, 255, 0.75)' : 'var(--ink-soft)', margin: '6px 0 14px' }}>{def.description}</p>
      {children}

      <div
        style={{
          display: 'inline-flex',
          border: isGlass ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid var(--line-strong)',
          borderRadius: 8,
          overflow: 'hidden',
          background: isGlass ? 'rgba(0, 0, 0, 0.25)' : '#fff'
        }}
        role="group"
        aria-label={`Who can open ${def.title}`}
      >
        {MODES.map((m, i) => {
          const isSelected = mode === m.mode;
          return (
            <button
              key={m.mode}
              type="button"
              title={m.hint}
              onClick={() => { setMode(m.mode); setMsg(null); }}
              style={{
                padding: '7px 18px',
                fontSize: 12.5,
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                borderLeft: i ? (isGlass ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid var(--line-strong)') : 'none',
                background: isSelected
                  ? (isGlass ? 'var(--maroon)' : 'var(--maroon)')
                  : (isGlass ? 'transparent' : '#fff'),
                color: isSelected
                  ? '#ffffff'
                  : (isGlass ? 'rgba(255, 255, 255, 0.75)' : 'var(--ink)')
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      {mode === null && (
        <p style={{ fontSize: 12, color: isGlass ? 'rgba(255, 255, 255, 0.75)' : 'var(--ink-soft)', marginTop: 8 }}>
          <b>Default rule:</b> {def.defaultRule} Pick one of the three to replace it.
        </p>
      )}
      {mode === 'ADMIN' && <p style={{ fontSize: 12, color: isGlass ? 'rgba(255, 255, 255, 0.75)' : 'var(--ink-soft)', marginTop: 8 }}>Only Admin will see this tab.</p>}
      {mode === 'NONE' && <p style={{ fontSize: 12, color: isGlass ? 'rgba(255, 255, 255, 0.75)' : 'var(--ink-soft)', marginTop: 8 }}>Nobody will see this tab, not even Admin. {saved.userIds.length > 0 ? `The ${saved.userIds.length} people you picked under Individual are kept.` : ''} Switch it back any time.</p>}
      {mode === 'ALL' && def.warnAll && <p style={{ fontSize: 12, color: isGlass ? '#fef08a' : '#92400E', marginTop: 8 }}>{def.warnAll}</p>}
      {mode === 'ALL' && !def.warnAll && <p style={{ fontSize: 12, color: isGlass ? 'rgba(255, 255, 255, 0.75)' : 'var(--ink-soft)', marginTop: 8 }}>Everyone will see this tab.</p>}
      {mode === 'INDIVIDUAL' && (
        <div style={{ marginTop: 12 }}>
          <UserMultiPicker users={people} selectedIds={ids} onChange={setIds} />
        </div>
      )}
      {mode === 'EXCEPT' && (
        <div style={{ marginTop: 12 }}>
          <p style={{ fontSize: 12, color: isGlass ? 'rgba(255, 255, 255, 0.75)' : 'var(--ink-soft)', margin: '0 0 6px' }}>Everyone has this tab <b>except</b> the people below. Search and add the people who must not see it.</p>
          <UserMultiPicker users={people} selectedIds={exceptIds} onChange={setExceptIds} placeholder="Search a name or ID to block…" />
        </div>
      )}
      {counts && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 12,
              background: isGlass ? 'rgba(119, 223, 192, 0.20)' : '#E6F5F5',
              border: isGlass ? '1px solid rgba(119, 223, 192, 0.40)' : '1px solid var(--teal)',
              color: isGlass ? '#77dfc0' : 'var(--teal-dark)'
            }}
          >
            {counts.yes} can open it
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 12,
              background: isGlass ? 'rgba(246, 139, 139, 0.20)' : '#FEE2E2',
              border: isGlass ? '1px solid rgba(246, 139, 139, 0.40)' : '1px solid #B91C1C',
              color: isGlass ? '#f68b8b' : '#991B1B'
            }}
          >
            {counts.no} cannot (NONE)
          </span>
          <span style={{ fontSize: 11.5, color: isGlass ? 'rgba(255, 255, 255, 0.65)' : 'var(--ink-muted)', alignSelf: 'center' }}>
            {mode === 'NONE' ? 'Admin cannot either.' : 'Admin always can.'} Counts are active staff, not including Admin.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={busy || !dirty}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        {saved.mode !== null && (
          <button className="btn btn-secondary btn-sm" onClick={() => { setMode(null); setMsg(null); }} disabled={busy || mode === null}>
            Use the default rule
          </button>
        )}
        {mode === 'INDIVIDUAL' && <span style={{ fontSize: '12.5px', color: isGlass ? 'rgba(255, 255, 255, 0.75)' : 'var(--ink-soft)' }}>{ids.length} added</span>}
        {mode === 'EXCEPT' && <span style={{ fontSize: '12.5px', color: isGlass ? 'rgba(255, 255, 255, 0.75)' : 'var(--ink-soft)' }}>{exceptIds.length} blocked</span>}
        {msg && <span style={{ fontSize: '12.5px', color: msg.ok ? (isGlass ? '#77dfc0' : '#166534') : (isGlass ? '#f68b8b' : '#B91C1C') }}>{msg.text}</span>}
      </div>
    </div>
  );
};

/** Admin only: for every tab pick ALL, ADMIN or Individual. Basic tabs are always open to everyone. */
export const TabAccessManager: React.FC = () => {
  const { theme } = useAppTheme();
  const isGlass = theme === 'glass';
  const [all, setAll] = useState<Record<TabAccessKey, TabAccessEntry> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [examSwitchOn, setExamSwitchOn] = useState<boolean | null>(null);

  useEffect(() => {
    let on = true;
    tabAccessService.getAll().then(a => { if (on) setAll(a); }).catch(e => { if (on) setError(e?.message || 'Could not load tab access.'); });
    examLeaveService.isEnabled().then(v => { if (on) setExamSwitchOn(v); }).catch(() => {});
    return () => { on = false; };
  }, []);

  if (error) return <div className="auth-alert-error">{error}</div>;
  if (!all) return <div className="loading-indicator">Loading tab access…</div>;

  return (
    <>
      <div className="table-card" style={{ padding: '16px 20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: isGlass ? '#FFFFFF' : 'var(--navy)', margin: 0 }}>
          <Lock size={18} /> Tab Access
        </h3>
        <p style={{ fontSize: '12.5px', color: isGlass ? 'rgba(255, 255, 255, 0.75)' : 'var(--ink-soft)', margin: '6px 0 0', lineHeight: 1.6 }}>
          For each tab below choose <b>ALL</b> (every active person), <b>ADMIN</b> (only you), <b>Individual</b> (you and the people you pick), <b>EXCEPT</b> (everyone but the people you pick) or <b>NONE</b> (switched off for everyone, you too).
          Until you choose, a tab keeps its old rule. The people you pick under Individual and under EXCEPT are each remembered when you switch to another option and back.
          <br />
          <Users size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          Always open to everyone, not listed here: <b>My Tasks, Task Requests, Notifications, My Profile</b>. Team Tasks follows each person’s designation.
        </p>
      </div>

      {TABS.map(def => (
        <TabCard
          key={def.key}
          def={def.key === 'exam_leave' && examSwitchOn !== null ? { ...def, defaultRule: `The old on/off switch (currently ${examSwitchOn ? 'ON' : 'OFF'}).` } : def}
          saved={all[def.key] ? { ...all[def.key], exceptIds: all[def.key].exceptIds ?? [] } : { mode: null, userIds: [], exceptIds: [] }}
          onSaved={entry => setAll(prev => (prev ? { ...prev, [def.key]: entry } : prev))}
        >
          {def.key === 'proposals' && (
            <DriveLinkBox
              title="Drive upload link (for proposal attachments)"
              help='Paste the web app link of the "Proposal Files" Google script (ends in /exec). Files are saved in your Drive as Attachment → Client name → file.'
              load={() => proposalService.getDriveUrl()}
              save={url => proposalService.setDriveUrl(url)}
            />
          )}
          {def.key === 'invoices' && (
            <DriveLinkBox
              title="Drive upload link (for VDS / TDS challan files)"
              help='Paste the web app link of the "Invoice Files" Google script (ends in /exec). Files are saved in your Drive as TDS-VDS → Invoice number → VDS or TDS → file.'
              load={() => invoiceService.getDriveUrl()}
              save={url => invoiceService.setDriveUrl(url)}
            />
          )}
        </TabCard>
      ))}
    </>
  );
};
