import { useCallback, useEffect, useState } from 'react';
import { Bell, Briefcase, CheckSquare, ClipboardList, FileText, Shield, User as UserIcon, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useLivePolling } from '../../lib/useLivePolling';
import { canViewManpower, canViewTeamTasks } from '../../lib/permissions';
import { api } from '../../services/api';
import { proposalService } from '../../services/proposalService';

export type TabKey = 'own' | 'team' | 'manpower' | 'proposals' | 'requests' | 'notifications' | 'profile' | 'admin';

interface NavigationTabsProps {
  activeTab: TabKey;
  onSelectTab: (tab: TabKey) => void;
}

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

  if (!currentUser) return null;

  // Team Tasks: In Charge and above (not Students)
  const showTeamTasksTab = canViewTeamTasks(currentUser);

  // Manpower: Admin or Assistant Director and above
  const showManpowerTab = canViewManpower(currentUser);

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

      {/* Proposal Tracker: only for people the Admin chose */}
      {proposalAccess && (
        <button
          className={`tab-btn ${activeTab === 'proposals' ? 'active' : ''}`}
          onClick={() => onSelectTab('proposals')}
        >
          <ClipboardList size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
          Proposal Tracker
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
