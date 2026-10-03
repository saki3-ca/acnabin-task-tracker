import React, { useEffect, useState } from 'react';
import { FileText, Users } from 'lucide-react';
import { proposalService } from '../../services/proposalService';
import { manpowerAccessService } from '../../services/manpowerAccessService';
import { TabAccessCard } from './TabAccessCard';

/** Admin only: who gets the Proposal Tracker and Manpower tabs. Admin always has both. */
export const ProposalAccess: React.FC = () => {
  const [driveUrl, setDriveUrl] = useState('');
  const [driveSaved, setDriveSaved] = useState('');
  const [driveMsg, setDriveMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    proposalService
      .getDriveUrl()
      .then(u => {
        setDriveUrl(u);
        setDriveSaved(u);
      })
      .catch(() => undefined);
  }, []);

  const saveDrive = async () => {
    setDriveMsg(null);
    try {
      await proposalService.setDriveUrl(driveUrl.trim());
      setDriveSaved(driveUrl.trim());
      setDriveMsg({ ok: true, text: driveUrl.trim() ? 'Saved. Attachments are now on.' : 'Saved. Attachments are now off.' });
    } catch (e: any) {
      setDriveMsg({ ok: false, text: e?.message || 'Could not save.' });
    }
  };

  return (
    <>
      <TabAccessCard
        title="Proposal Tracker Access"
        icon={<FileText size={18} />}
        description="Search and add the people who should see the Proposal Tracker tab. They can add and edit proposals. Only Admin can delete."
        load={() => proposalService.getAccess()}
        save={ids => proposalService.setAccess(ids)}
      >
      <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid var(--line)', marginBottom: '16px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--navy)', marginBottom: '4px' }}>Drive upload link (for proposal attachments)</div>
        <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginBottom: '8px' }}>
          Paste the web app link of the "Proposal Files" Google script (ends in /exec). Files are saved in your Drive as Attachment → Client name → file.
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="form-input" placeholder="https://script.google.com/macros/s/…/exec" value={driveUrl} onChange={e => setDriveUrl(e.target.value)} style={{ flex: '1 1 360px' }} />
          <button className="btn btn-primary btn-sm" onClick={saveDrive} disabled={driveUrl.trim() === driveSaved}>Save link</button>
          {driveMsg && <span style={{ fontSize: '12.5px', color: driveMsg.ok ? '#166534' : '#B91C1C' }}>{driveMsg.text}</span>}
        </div>
      </div>
      </TabAccessCard>
      <TabAccessCard
        title="Manpower Access"
        icon={<Users size={18} />}
        description="Search and add anyone who should see the Manpower tab (including salary figures). Assistant Directors and above already have it."
        load={() => manpowerAccessService.get()}
        save={ids => manpowerAccessService.set(ids)}
      />
    </>
  );
};
