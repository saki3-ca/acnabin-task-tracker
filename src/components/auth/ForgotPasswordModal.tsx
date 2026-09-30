import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Modal } from '../ui/Modal';

// URL slug of the deployed request-password-reset Edge Function
// (the Supabase dashboard assigned it "quick-processor").
const RESET_FUNCTION_SLUG = 'quick-processor';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose
}) => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setError(null);
    setSending(true);
    try {
      const { error: fnError } = await supabase.functions.invoke(RESET_FUNCTION_SLUG, {
        body: { email: email.trim() }
      });
      if (fnError) {
        let message = 'Could not send the reset email. Please try again later.';
        try {
          const body = await (fnError as any).context?.json?.();
          if (body?.message) message = body.message;
        } catch { }
        setError(message);
        return;
      }
      setSubmitted(true);
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => {
    setEmail('');
    setSubmitted(false);
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleReset} title="Password Reset">
      <div className="modal-body">
        {submitted ? (
          <div className="auth-alert-success">
            If an account is registered with <strong>{email}</strong>, a reset link has been sent. It expires in 60 minutes. Check your inbox and spam folder.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {error && <div className="auth-alert-error">{error}</div>}
            <p style={{ fontSize: '13px', color: 'var(--ink-soft)' }}>
              Enter your registered official email address. A password reset link will be dispatched to your email.
            </p>
            <div className="form-field">
              <label>Official Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="form-input"
                placeholder="name@gmail.com"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }} disabled={sending}>
              <Mail size={16} /> {sending ? 'Sending…' : 'Send Reset Link'}
            </button>
          </form>
        )}
      </div>

      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={handleReset}>
          Close
        </button>
      </div>
    </Modal>
  );
};
