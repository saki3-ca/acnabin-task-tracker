import React, { useEffect, useState } from 'react';
import { FileText, GraduationCap, Receipt, Search, Users } from 'lucide-react';
import { examLeaveService } from '../../services/examLeaveService';
import { invoiceService } from '../../services/invoiceService';
import { manpowerAccessService } from '../../services/manpowerAccessService';
import { proposalService } from '../../services/proposalService';
import { tenderAgentService } from '../../services/tenderAgentService';
import { DriveLinkBox } from './DriveLinkBox';
import { TabAccessCard } from './TabAccessCard';

/** Admin only: switch the Exam Leave tab on for everyone during exam time, off the rest of the year. */
const ExamLeaveSwitch: React.FC = () => {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    examLeaveService.isEnabled().then(setEnabled).catch(() => setEnabled(true));
  }, []);

  const toggle = async () => {
    if (enabled === null) return;
    setBusy(true);
    setMsg(null);
    try {
      await examLeaveService.setEnabled(!enabled);
      setEnabled(!enabled);
      setMsg({ ok: true, text: !enabled ? 'Exam Leave tab is now ON for everyone.' : 'Exam Leave tab is now OFF for everyone (Admin still sees it).' });
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not save.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="table-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--navy)' }}>
        <GraduationCap size={18} /> Exam Leave Tab
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px', marginBottom: '14px' }}>
        Turn this on only during the exam period. When it is off, nobody except Admin sees the Exam Leave tab. When it is on, each person sees their own client team; Assistant Directors and above see everyone.
      </p>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <button className={enabled ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'} onClick={toggle} disabled={busy || enabled === null}>
          {busy ? 'Saving…' : enabled ? 'Turn off for everyone' : 'Turn on for everyone'}
        </button>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: enabled ? '#166534' : '#B91C1C' }}>
          {enabled === null ? 'Loading…' : enabled ? 'Currently ON' : 'Currently OFF'}
        </span>
        {msg && <span style={{ fontSize: '12.5px', color: msg.ok ? '#166534' : '#B91C1C' }}>{msg.text}</span>}
      </div>
    </div>
  );
};

/** Admin only: who gets the Proposal Tracker, Manpower, Invoices and Tender Agent tabs. Admin always has all of them. */
export const ProposalAccess: React.FC = () => (
  <>
    <ExamLeaveSwitch />
    <TabAccessCard
      title="Proposal Tracker Access"
      icon={<FileText size={18} />}
      description="Search and add the people who should see the Proposal Tracker tab. They can add and edit proposals. Only Admin can delete."
      load={() => proposalService.getAccess()}
      save={ids => proposalService.setAccess(ids)}
    >
      <DriveLinkBox
        title="Drive upload link (for proposal attachments)"
        help='Paste the web app link of the "Proposal Files" Google script (ends in /exec). Files are saved in your Drive as Attachment → Client name → file.'
        load={() => proposalService.getDriveUrl()}
        save={url => proposalService.setDriveUrl(url)}
      />
    </TabAccessCard>
    <TabAccessCard
      title="Manpower Access"
      icon={<Users size={18} />}
      description="Search and add anyone who should see the Manpower tab (including salary figures). Assistant Directors and above already have it."
      load={() => manpowerAccessService.get()}
      save={ids => manpowerAccessService.set(ids)}
    />
    <TabAccessCard
      title="Invoices Access"
      icon={<Receipt size={18} />}
      description="Search and add anyone who should see the Invoices tab. They can add and edit invoices. Only Admin can delete."
      load={() => invoiceService.getAccess()}
      save={ids => invoiceService.setAccess(ids)}
    >
      <DriveLinkBox
        title="Drive upload link (for VDS / TDS challan files)"
        help='Paste the web app link of the "Invoice Files" Google script (ends in /exec). Files are saved in your Drive as TDS-VDS → Invoice number → VDS or TDS → file.'
        load={() => invoiceService.getDriveUrl()}
        save={url => invoiceService.setDriveUrl(url)}
      />
    </TabAccessCard>
    <TabAccessCard
      title="Tender Agent Access"
      icon={<Search size={18} />}
      description="Search and add anyone who should see the Tender Agent tab (bank, NGO and IT tender monitoring). Only people added here, and Admin, can open it."
      load={() => tenderAgentService.getAccess()}
      save={ids => tenderAgentService.setAccess(ids)}
    />
  </>
);
