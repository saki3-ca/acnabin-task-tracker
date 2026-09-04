import React, { useState } from 'react';
import { KeyRound, Lock, LogIn, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { BRAND } from '../../lib/constants';

interface LoginFormProps {
  onSwitchToSignup: () => void;
  onSwitchToForgot: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({
  onSwitchToSignup,
  onSwitchToForgot
}) => {
  const { login } = useAuth();
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId.trim()) {
      setError('Please enter your Employee ID or Email address.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(empId, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-card-header">
          <div
            className="brand-logo-badge"
            style={{ width: 56, height: 56, fontSize: 20, margin: '0 auto 12px' }}
          >
            {BRAND.initials}
          </div>
          <h2 className="auth-card-title">{BRAND.name}</h2>
          <p className="auth-card-subtitle">Task & To-Do Tracking Portal</p>
        </div>

        {error && <div className="auth-alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-field">
            <label>Employee / Student ID / Partner Initial</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={empId}
                onChange={e => setEmpId(e.target.value)}
                className="form-input"
                placeholder="e.g. STD-001643 or EMP-000230 or AB"
                style={{ paddingLeft: '36px' }}
                autoFocus
              />
              <UserIcon
                size={16}
                style={{ position: 'absolute', left: 10, top: 11, color: 'var(--ink-soft)' }}
              />
            </div>
          </div>

          <div className="form-field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Password</label>
              <button
                type="button"
                onClick={onSwitchToForgot}
                className="btn-link"
                style={{ fontSize: '11px', padding: 0 }}
              >
                Forgot password?
              </button>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="form-input"
                placeholder="Enter password"
                style={{ paddingLeft: '36px' }}
              />
              <Lock
                size={16}
                style={{ position: 'absolute', left: 10, top: 11, color: 'var(--ink-soft)' }}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '6px' }}>
            <LogIn size={16} /> {loading ? 'Authenticating…' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: '12.5px', color: 'var(--ink-soft)' }}>
          Don't have an account?{' '}
          <button type="button" onClick={onSwitchToSignup} className="btn-link" style={{ fontWeight: 600 }}>
            Sign up
          </button>
        </div>
      </div>
    </div>
  );
};
