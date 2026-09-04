import { Bell, CheckSquare, FileText, Shield, User as UserIcon, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { canViewTeamTasks } from '../../lib/permissions';

export type TabKey = 'own' | 'team' | 'requests' | 'notifications' | 'profile' | 'admin';

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
  if (!currentUser) return null;

  // Team Tasks: In Charge and above (not Students)
  const showTeamTasksTab = canViewTeamTasks(currentUser);

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

      {/* 5. My Profile */}
      <button
        className={`tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
        onClick={() => onSelectTab('profile')}
      >
        <UserIcon size={15} style={{ marginRight: 6, verticalAlign: 'middle' }} />
        My Profile
      </button>

      {/* 6. Admin Panel */}
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
