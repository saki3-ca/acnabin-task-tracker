import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { taskRequestService } from '../../services/taskRequestService';
import { canViewAllClients, getEligibleTaskRequestRecipients, isAssistantDirectorOrAbove } from '../../lib/permissions';
import { Priority } from '../../types';
import { Modal } from '../ui/Modal';

interface RequestTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RequestTaskModal: React.FC<RequestTaskModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, allClients, allUsers } = useAuth();
  const { refreshRequests, refreshNotifications } = useNotifications();

  const canSeeAll = canViewAllClients(currentUser);
  const isStudent = currentUser?.designation === 'Student';
  const isADPlus = isAssistantDirectorOrAbove(currentUser?.designation);

  // Client scoping for the requester
  const userClientIds = useMemo(() => {
    if (!currentUser) return [];
    const ids: string[] = [];
    if (currentUser.assignedClientIds && Array.isArray(currentUser.assignedClientIds)) {
      ids.push(...currentUser.assignedClientIds);
    }
    if (currentUser.signupClientId) {
      currentUser.signupClientId.split(',').forEach(s => {
        const trimmed = s.trim();
        if (trimmed && !ids.includes(trimmed)) ids.push(trimmed);
      });
    }
    return ids;
  }, [currentUser]);

  const availableClients = useMemo(() => {
    if (canSeeAll) return allClients;
    const filtered = allClients.filter(c => userClientIds.includes(c.id));
    return filtered.length > 0 ? filtered : allClients;
  }, [canSeeAll, allClients, userClientIds]);

  const [clientId, setClientId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [particular, setParticular] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize client selection for non-AD+
  useEffect(() => {
    if (!isADPlus && availableClients.length > 0 && !clientId) {
      setClientId(availableClients[0].id);
    }
  }, [availableClients, clientId, isADPlus]);

  const activeClientId = (!canSeeAll && availableClients.length === 1 && !isADPlus)
    ? availableClients[0].id
    : clientId;

  // Compute eligible recipients based on client and user role
  const { peers, superiors } = useMemo(() => {
    return getEligibleTaskRequestRecipients(currentUser, allUsers, activeClientId);
  }, [currentUser, allUsers, activeClientId]);

  // Auto-select first recipient if available
  useEffect(() => {
    const allRecipients = [...peers, ...superiors];
    if (allRecipients.length > 0) {
      if (!targetUserId || !allRecipients.some(u => u.id === targetUserId)) {
        setTargetUserId(allRecipients[0].id);
      }
    } else {
      setTargetUserId('');
    }
  }, [peers, superiors, targetUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!targetUserId) {
      alert('Please select an eligible recipient to send this task request to.');
      return;
    }
    if (!particular.trim()) {
      alert('Please describe the task to be performed.');
      return;
    }

    const allRecipients = [...peers, ...superiors];
    const targetUser = allRecipients.find(u => u.id === targetUserId);
    const selectedClient = availableClients.find(c => c.id === clientId) || allClients.find(c => c.id === clientId);

    setIsSubmitting(true);
    try {
      await taskRequestService.createTaskRequest({
        requesterId: currentUser.id,
        requesterName: currentUser.name,
        superiorId: targetUserId,
        superiorName: targetUser?.name || 'Recipient',
        clientId: selectedClient?.id || clientId || 'general',
        clientName: selectedClient?.name || 'General',
        particular,
        priority,
        deadline,
        notes
      });

      await refreshRequests();
      await refreshNotifications();
      alert(`Task request submitted to ${targetUser?.name || 'recipient'} successfully!`);
      onClose();
      setParticular('');
      setNotes('');
      setDeadline('');
    } catch (err) {
      console.error('Failed to submit task request', err);
      alert('Failed to submit task request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalRecipients = peers.length + superiors.length;

  const renderClientSelect = () => (
    <div className="form-field">
      <label>{isADPlus ? 'Client (Optional / General Engagement)' : 'Client'}</label>
      {!canSeeAll && availableClients.length === 1 && !isADPlus ? (
        <div
          style={{
            padding: '9px 12px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-soft)',
            border: '1.5px solid var(--line-strong)',
            fontSize: '13.5px',
            fontWeight: 600,
            color: 'var(--ink)'
          }}
        >
          {availableClients[0].name}{' '}
          {availableClients[0].jobNumber ? `(${availableClients[0].jobNumber})` : ''}
        </div>
      ) : (
        <select
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          className="form-select"
          required={!isADPlus}
        >
          <option value="">
            {isADPlus ? 'General / Firm Internal (Optional)' : 'Select client…'}
          </option>
          {allClients.map(c => (
            <option key={c.id} value={c.id}>
              {c.name} {c.jobNumber ? `(${c.jobNumber})` : ''}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  const renderRecipientSelect = () => (
    <div className="form-field">
      <label>
        {isADPlus
          ? 'Request To (AD / Director / Partner)'
          : isStudent
          ? 'Request To (Peer / Leader)'
          : 'Request To Superior'}
      </label>
      <select
        value={targetUserId}
        onChange={e => setTargetUserId(e.target.value)}
        className="form-select"
        required
      >
        <option value="">
          {totalRecipients === 0
            ? 'No eligible team members found'
            : 'Select recipient…'}
        </option>

        {isStudent && peers.length > 0 && (
          <optgroup label="Fellow Students (Same Client)">
            {peers.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (Student)
              </option>
            ))}
          </optgroup>
        )}

        {isStudent && superiors.length > 0 && (
          <optgroup label="Engagement Leadership (In-Charge to Manager)">
            {superiors.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.designation})
              </option>
            ))}
          </optgroup>
        )}

        {!isStudent && superiors.length > 0 && (
          <optgroup label={isADPlus ? 'Senior Management (AD to Partner)' : 'Superiors'}>
            {superiors.map(s => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.designation})
              </option>
            ))}
          </optgroup>
        )}
      </select>
    </div>
  );

  let modalTitle = 'Request Task to Superior';
  if (isADPlus) {
    modalTitle = 'Request Task (Senior Management)';
  } else if (isStudent) {
    modalTitle = 'Request Task (Peer / Engagement Leader)';
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={modalTitle}
    >
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          {/* For AD+: Name first, then Client (Optional). For others: Client first, then Name */}
          {isADPlus ? (
            <>
              {renderRecipientSelect()}
              {renderClientSelect()}
            </>
          ) : (
            <>
              {renderClientSelect()}
              {renderRecipientSelect()}
            </>
          )}

          {/* Particulars */}
          <div className="form-field">
            <label>Task Particulars / Procedure</label>
            <textarea
              value={particular}
              onChange={e => setParticular(e.target.value)}
              className="form-textarea"
              placeholder="Describe the audit task or procedure to be assigned..."
              required
            />
          </div>

          {/* Priority & Deadline */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-field">
              <label>Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as Priority)}
                className="form-select"
              >
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div className="form-field">
              <label>Suggested Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Justification / Notes */}
          <div className="form-field">
            <label>Reason / Notes for Superior</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="form-textarea"
              placeholder="Provide context or explanation for this task request..."
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
