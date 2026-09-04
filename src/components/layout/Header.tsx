import React from 'react';
import { FileText, LogOut, Plus, RefreshCw, UserCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BRAND } from '../../lib/constants';
import { canRequestTask } from '../../lib/permissions';

interface HeaderProps {
  onOpenAddTask: () => void;
  onOpenRequestTask?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenAddTask, onOpenRequestTask }) => {
  const { currentUser, allUsers, switchUser, logout } = useAuth();

  if (!currentUser) return null;

  const showRequestBtn = canRequestTask(currentUser);

  const roleBadgeClass = () => {
    if (currentUser.role === 'ADMIN') return 'role-badge admin';
    if (currentUser.role === 'MANAGER') return 'role-badge manager';
    return 'role-badge user';
  };

  const todayStr = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <header className="top-header">
      {/* Brand Section with Real Official ACNABIN Logo */}
      <div className="brand-section">
        <img
          src="/acnabin-logo.png"
          alt="ACNABIN Chartered Accountants"
          className="brand-logo-img"
        />
      </div>

      {/* Center Masthead */}
      <div className="center-masthead">
        <h1 className="masthead-title">MY TASKS</h1>
        <div className="masthead-subtitle">{todayStr}</div>
      </div>

      {/* User Section */}
      <div className="user-section">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {currentUser.avatarUrl && (
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: '1.5px solid var(--navy)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
              }}
            />
          )}
          <div>
            <div className="user-name">{currentUser.name}</div>
            {currentUser.signupClientName ? (
              <div className="user-client">{currentUser.signupClientName}</div>
            ) : null}
          </div>
        </div>

        <span className={roleBadgeClass()}>{currentUser.designation}</span>

        {/* Demo Quick Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
          <span style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>Switch User:</span>
          <select
            value={currentUser.id}
            onChange={e => switchUser(e.target.value)}
            style={{
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid var(--line-strong)',
              background: '#fff'
            }}
            title="Switch user role for testing"
          >
            {allUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.designation})
              </option>
            ))}
          </select>
        </div>

        {/* Actions Nav */}
        <div className="user-actions-nav" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {showRequestBtn && onOpenRequestTask && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onOpenRequestTask}
              title="Request task"
              style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <FileText size={13} /> Request Task
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={onOpenAddTask}>
            <Plus size={14} /> Add Task
          </button>
          <button className="btn btn-secondary btn-sm" onClick={logout} title="Sign out">
            <LogOut size={14} /> Logout
          </button>
        </div>
      </div>
    </header>
  );
};
