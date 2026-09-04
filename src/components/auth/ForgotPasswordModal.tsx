import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import { Modal } from '../ui/Modal';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  };

  const handleReset = () => {
    setEmail('');
    setSubmitted(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleReset} title="Password Reset">
      <div className="modal-body">
        {submitted ? (
          <div className="auth-alert-success">
            Password reset instructions have been sent to <strong>{email}</strong>. Please check your inbox.
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
            <button type="submit" className="btn btn-primary" style={{ marginTop: '8px' }}>
              <Mail size={16} /> Send Reset Link
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
