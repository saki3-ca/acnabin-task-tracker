import { useCallback, useEffect, useState } from 'react';
import { Bell, BarChart3, Briefcase, CheckSquare, ClipboardList, FileText, GraduationCap, Receipt, Search, Shield, User as UserIcon, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useLivePolling } from '../../lib/useLivePolling';
import { canViewFirmCosting, canViewManpower, canViewManpowerScoped, canViewTeamTasks } from '../../lib/permissions';
import { api } from '../../services/api';
import { invoiceService } from '../../services/invoiceService';
import { manpowerAccessService } from '../../services/manpowerAccessService';
import { proposalService } from '../../services/proposalService';
import { tenderAgentService } from '../../services/tenderAgentService';
import { examLeaveService } from '../../services/examLeaveService';
import { tabAccessService } from '../../services/tabAccessService';
import { MyTabAccess, TabAccessKey } from '../../types';

export type TabKey = 'own' | 'team' | 'manpower' | 'firm-costing' | 'exam-leave' | 'invoices' | 'proposals' | 'tenders' | 'requests' | 'notifications' | 'profile' | 'admin';

interface NavigationTabsProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
}

/**
 * The tab setting Admin saved: true / false when a choice exists, undefined while none is saved (the old rule then applies).
 * ALL = everyone, ADMIN = only Admin, INDIVIDUAL = the people on the list, NONE = nobody.
 */
const savedChoice = (mine: MyTabAccess | null, key: TabAccessKey, isAdmin: boolean): boolean | undefined => {
  const m = mine?.[key];
  // NONE switches the tab off for everybody, Admin too
  if (m?.mode === 'NONE') return false;
  if (isAdmin) return true;
  if (!m || !m.mode) return undefined;
  if (m.mode === 'EXCEPT') return !m.excluded;
  return m.mode === 'ALL' ? true : m.mode === 'ADMIN' ? false : m.listed;
};

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onSelectTab
}) => {
  const { currentUser } = useAuth();
  const { pendingRequestsCount, unreadCount } = useNotifications();

  // The Proposal Tracker tab is only for people the Admin chose (Admin always has it)
  const isAdminUser = currentUser?.role === 'ADMIN';
  const [proposalAccess, setProposalAccess] = useState(false);
  const checkProposalAccess = useCallback(async () => {
    if (!currentUser) return;
    if (isAdminUser) return setProposalAccess(true);
    if (api.isViewingAsAnother()) {
      // Admin using Switch User: the saved login is the Admin's, so ask whether THIS person was given access
      const ids = await proposalService.getAccess().catch(() => [] as string[]);
      return setProposalAccess(ids.includes(currentUser.id));
    }
    setProposalAccess(await proposalService.hasAccess().catch(() => false));
  }, [currentUser?.id, isAdminUser]);
  useEffect(() => {
    void checkProposalAccess();
  }, [checkProposalAccess]);
  useLivePolling(() => checkProposalAccess(), 60000, Boolean(currentUser));

  // Exam Leave: switched on by Admin for exam time; Admin always sees it
  const [examLeaveOn, setExamLeaveOn] = useState<boolean | null>(null);
  const checkExamLeave = useCallback(async () => {
    if (!currentUser) return;
    if (isAdminUser) return setExamLeaveOn(true);
    setExamLeaveOn(await examLeaveService.isEnabled().catch(() => true));
  }, [currentUser?.id, isAdminUser]);
  useEffect(() => {
    void checkExamLeave();
  }, [checkExamLeave]);
  useLivePolling(() => checkExamLeave(), 60000, Boolean(currentUser));
  // Switched off while someone is on the tab: send them home
  useEffect(() => {
    if (examLeaveOn === false && activeTab === 'exam-leave') onSelectTab('own');
  }, [examLeaveOn, activeTab, onSelectTab]);

  // Invoices: Admin plus the people the Admin chose
  const [invoiceAccess, setInvoiceAccess] = useState(false);
  const checkInvoiceAccess = useCallback(async () => {
    if (!currentUser) return;
    if (isAdminUser) return setInvoiceAccess(true);
    if (api.isViewingAsAnother()) {
      const ids = await invoiceService.getAccess().catch(() => [] as string[]);
      return setInvoiceAccess(ids.includes(currentUser.id));
    }
    setInvoiceAccess(await invoiceService.hasAccess().catch(() => false));
  }, [currentUser?.id, isAdminUser]);
  useEffect(() => {
    void checkInvoiceAccess();
  }, [checkInvoiceAccess]);
  useLivePolling(() => checkInvoiceAccess(), 60000, Boolean(currentUser));

  // Tender Agent: Admin plus the people the Admin chose
  const [tenderAccess, setTenderAccess] = useState(false);
  const checkTenderAccess = useCallback(async () => {
    if (!currentUser) return;
    if (isAdminUser) return setTenderAccess(true);
    if (api.isViewingAsAnother()) {
      const ids = await tenderAgentService.getAccess().catch(() => [] as string[]);
      return setTenderAccess(ids.includes(currentUser.id));
    }
    setTenderAccess(await tenderAgentService.hasAccess().catch(() => false));
  }, [currentUser?.id, isAdminUser]);
  useEffect(() => {
    void checkTenderAccess();
  }, [checkTenderAccess]);
  useLivePolling(() => checkTenderAccess(), 60000, Boolean(currentUser));

  // Manpower is for Assistant Director and above, plus anyone the Admin added
  const [manpowerGranted, setManpowerGranted] = useState(false);
  const checkManpowerAccess = useCallback(async () => {
    if (!currentUser) return;
    if (isAdminUser || canViewManpower(currentUser)) return setManpowerGranted(false);
    if (api.isViewingAsAnother()) {
      const ids = await manpowerAccessService.get().catch(() => [] as string[]);
      return setManpowerGranted(ids.includes(currentUser.id));
    }
    setManpowerGranted(await manpowerAccessService.hasAccess().catch(() => false));
  }, [currentUser?.id, currentUser?.designation, isAdminUser]);
  useEffect(() => {
    void checkManpowerAccess();
  }, [checkManpowerAccess]);
  useLivePolling(() => checkManpowerAccess(), 60000, Boolean(currentUser));

  // The ALL / ADMIN / Individual choice Admin saved for each tab (none saved = the old rules above)
  const [mine, setMine] = useState<MyTabAccess | null>(null);
  const checkMine = useCallback(async () => {
    if (!currentUser) return;
    setMine(await tabAccessService.mine().catch(() => null));
  }, [currentUser?.id]);
  useEffect(() => {
    void checkMine();
  }, [checkMine]);
  useLivePolling(() => checkMine(), 60000, Boolean(currentUser));

  const choice = (key: TabAccessKey) => savedChoice(mine, key, isAdminUser);
  // Admin took a tab away while someone is on it: send them home
  useEffect(() => {
    const tabOf: Partial<Record<TabKey, TabAccessKey>> = { manpower: 'manpower', 'firm-costing': 'firm_costing', 'exam-leave': 'exam_leave', invoices: 'invoices', proposals: 'proposals', tenders: 'tenders' };
    const key = tabOf[activeTab];
    if (key && choice(key) === false) onSelectTab('own');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mine, activeTab]);

  if (!currentUser) return null;

  // Team Tasks: In Charge and above, and Team Leaders (students with a team assigned)
  const showTeamTasksTab = canViewTeamTasks(currentUser);

  // Manpower: Admin, Assistant Director and above, In Charge to Manager (own clients only) or anyone the Admin added
  const showManpowerTab = choice('manpower') ?? (canViewManpower(currentUser) || canViewManpowerScoped(currentUser) || manpowerGranted);
  const showFirmCostingTab = choice('firm_costing') ?? canViewFirmCosting(currentUser);
  const showExamLeaveTab = choice('exam_leave') ?? Boolean(examLeaveOn);
  const showInvoicesTab = choice('invoices') ?? invoiceAccess;
  const showProposalsTab = choice('proposals') ?? proposalAccess;
  const showTendersTab = choice('tenders') ?? tenderAccess;

  // Task Requests, Notifications & My Profile: available for all practice users
  const showRequestsTab = currentUser.role !== 'ADMIN';

  // Admin: only ADMIN role
  const showAdminTab = currentUser.role === 'ADMIN';

  return (
    <nav className="nav-tabs" aria-label="Dashboard views">
      {/* 1. My Tasks */}
      <button
        className={`tab-btn ${activeTab === 'own' ? 'active' : ''}`}
        onClick={() => onSelectTab('own')}
      >
        <CheckSquare size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
        My Tasks
      </button>

      {/* 2. Team Tasks */}
      {showTeamTasksTab && (
        <button
          className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
          onClick={() => onSelectTab('team')}
        >
          <Users size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Team Tasks
        </button>
      )}

      {/* 3. Task Requests */}
      {showRequestsTab && (
        <button
          className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => onSelectTab('requests')}
          style={{ position: 'relative' }}
        >
          <FileText size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Task Requests
          {pendingRequestsCount > 0 && (
            <span
              style={{
                marginLeft: '6px',
                background: 'var(--maroon)',
                color: '#fff',
                fontSize: '10.5px',
                fontWeight: 700,
                padding: '1px 6px',
                borderRadius: '10px'
              }}
            >
              {pendingRequestsCount}
            </span>
          )}
        </button>
      )}

      {/* 4. Notifications */}
      <button
        className={`tab-btn ${activeTab === 'notifications' ? 'active' : ''}`}
        onClick={() => onSelectTab('notifications')}
        style={{ position: 'relative' }}
      >
        <Bell size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
        Notifications
        {unreadCount > 0 && (
          <span
            style={{
              marginLeft: '6px',
              background: 'var(--maroon)',
              color: '#fff',
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '10px'
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* 5. Manpower */}
      {showManpowerTab && (
        <button
          className={`tab-btn ${activeTab === 'manpower' ? 'active' : ''}`}
          onClick={() => onSelectTab('manpower')}
        >
          <Briefcase size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Manpower
        </button>
      )}

      {/* Firm Costing: Admin, Assistant Director and above */}
      {showFirmCostingTab && (
        <button
          className={`tab-btn ${activeTab === 'firm-costing' ? 'active' : ''}`}
          onClick={() => onSelectTab('firm-costing')}
        >
          <BarChart3 size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Firm Costing
        </button>
      )}

      {/* Exam Leave: only while Admin has it switched on */}
      {showExamLeaveTab && (
      <button
        className={`tab-btn ${activeTab === 'exam-leave' ? 'active' : ''}`}
        onClick={() => onSelectTab('exam-leave')}
      >
        <GraduationCap size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
        Exam Leave
      </button>
      )}

      {/* Invoices: only for people the Admin chose */}
      {showInvoicesTab && (
        <button
          className={`tab-btn ${activeTab === 'invoices' ? 'active' : ''}`}
          onClick={() => onSelectTab('invoices')}
        >
          <Receipt size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Invoices
        </button>
      )}

      {/* Proposal Tracker: only for people the Admin chose */}
      {showProposalsTab && (
        <button
          className={`tab-btn ${activeTab === 'proposals' ? 'active' : ''}`}
          onClick={() => onSelectTab('proposals')}
        >
          <ClipboardList size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Proposal Tracker
        </button>
      )}

      {/* Tender Agent: only for people the Admin chose */}
      {showTendersTab && (
        <button
          className={`tab-btn ${activeTab === 'tenders' ? 'active' : ''}`}
          onClick={() => onSelectTab('tenders')}
        >
          <Search size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Tender Agent
        </button>
      )}

      {/* 6. My Profile */}
      <button
        className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => onSelectTab('profile')}
      >
        <UserIcon size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
        My Profile
      </button>

      {/* 7. Admin Panel */}
      {showAdminTab && (
        <button
          className={`tab-btn admin-tab ${activeTab === 'admin' ? 'active' : ''}`}
          onClick={() => onSelectTab('admin')}
        >
          <Shield size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Admin Panel
        </button>
      )}
    </nav>
  );
};
