import React from 'react';
import { FileText, Receipt, Search, Users } from 'lucide-react';
import { invoiceService } from '../../services/invoiceService';
import { manpowerAccessService } from '../../services/manpowerAccessService';
import { proposalService } from '../../services/proposalService';
import { tenderAgentService } from '../../services/tenderAgentService';
import { DriveLinkBox } from './DriveLinkBox';
import { TabAccessCard } from './TabAccessCard';

/** Admin only: who gets the Proposal Tracker, Manpower, Invoices and Tender Agent tabs. Admin always has all of them. */
export const ProposalAccess: React.FC = () => (
  <>
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
