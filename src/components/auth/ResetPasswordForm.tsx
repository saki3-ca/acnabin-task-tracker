import React, { useState } from 'react';
import { KeyRound, Lock } from 'lucide-react';
import { BRAND } from '../../lib/constants';
import { supabase } from '../../lib/supabase';

interface ResetPasswordFormProps {
  token: string;
  onDone: (message: string) => void;
}

const MIN_PASSWORD_LENGTH = 4;

export const ResetPasswordForm: React.FC<ResetPasswordFormProps> = ({ token, onDone }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data, error: rpcError } = await supabase.rpc('app_reset_password', {
        p_token: token,
        p_new: password
      });
      if (rpcError) {
        console.error('app_reset_password failed:', rpcError);
        setError('Password reset is unavailable right now. Please try again later.');
      } else if (data === 'OK') {
        onDone('Your password has been reset. Log in with your new password.');
      } else if (data === 'TOO_SHORT') {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      } else {
        setError('This reset link is invalid, expired, or already used. Request a new one from the login page.');
      }
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
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
            style={{ width: 56, height: 56, fontSize: 'var(--text-lg)', margin: '0 auto 12px' }}
          >
            {BRAND.initials}
          </div>
          <h2 className="auth-card-title">Choose a New Password</h2>
          <p className="auth-card-subtitle">{BRAND.name}</p>
        </div>

        {error && <div className="auth-alert-error">{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-field">
            <label>New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="form-input"
                placeholder="Enter new password"
                style={{ paddingLeft: '36px' }}
                autoComplete="new-password"
                autoFocus
                required
              />
              <Lock size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--ink-soft)' }} />
            </div>
          </div>

          <div className="form-field">
            <label>Confirm New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                className="form-input"
                placeholder="Re-enter new password"
                style={{ paddingLeft: '36px' }}
                autoComplete="new-password"
                required
              />
              <Lock size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--ink-soft)' }} />
            </div>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ marginTop: '6px' }}>
            <KeyRound size={16} /> {loading ? 'Saving…' : 'Reset Password'}
          </button>
        </form>

        <div style={{ textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--ink-soft)' }}>
          <button
            type="button"
            onClick={() => onDone('')}
            style={{ background: 'none', border: 'none', color: 'var(--navy)', cursor: 'pointer', fontWeight: 600 }}
          >
            Back to login
          </button>
        </div>
      </div>
    </div>
  );
};
