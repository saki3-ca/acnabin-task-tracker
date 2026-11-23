import React from 'react';
import { BRAND } from '../../lib/constants';
import { User } from '../../types';

/**
 * Shown instead of the app to an account that is not active: a senior signup (Assistant Director
 * and above) still waiting for an Admin, or an account an Admin deactivated.
 */
export const PendingApproval: React.FC<{
  user: User;
  onLogout: () => Promise<void>;
}> = ({ user, onLogout }) => {
  const pending = user.pendingApproval !== false;

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card-header">
          <div className="brand-logo-badge" style={{ width: 56, height: 56, fontSize: 20, margin: '0 auto 12px' }}>
            {BRAND.initials}
          </div>
          <h2 className="auth-card-title">{pending ? 'Waiting for approval' : 'Account inactive'}</h2>
          <p className="auth-card-subtitle">
            {user.name} · {user.empId} · {user.designation}
          </p>
        </div>

        <p style={{ fontSize: '13.5px', lineHeight: 1.55, color: 'var(--ui-text-soft)', textAlign: 'center' }}>
          {pending
            ? 'Your account has been created. Accounts for Assistant Director and above need an Admin to approve them before they can use the portal. Once an Admin activates your account, log in again with your ID and password.'
            : 'This account has been deactivated. Please contact an administrator if you think this is a mistake.'}
        </p>

        <button type="button" className="btn btn-primary" onClick={() => void onLogout()}>
          Back to login
        </button>
      </div>
    </div>
  );
};
