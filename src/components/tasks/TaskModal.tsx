import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { todayInputDate, toInputDate } from '../../lib/dateUtils';
import {
  canAssignTasks,
  canViewAllClients,
  getAssignableUsers
} from '../../lib/permissions';
import { Priority, Task, TaskStatus } from '../../types';
import { Modal } from '../ui/Modal';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskToEdit: Task | null;
  mode?: 'own' | 'team';
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  taskToEdit,
  mode = 'own'
}) => {
  const { currentUser, allClients, allUsers } = useAuth();
  const { createTask, updateTask } = useTasks();

  const isEditing = Boolean(taskToEdit);
  const isManager = canAssignTasks(currentUser);
  const canSeeAll = canViewAllClients(currentUser);

  // Compute assigned client IDs for the user
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

  // Restrict client options for non-all-access users
  const availableClients = useMemo(() => {
    if (canSeeAll) return allClients;

    let list = allClients.filter(c => userClientIds.includes(c.id));

    // When editing an existing task, preserve the task's existing client in the options
    if (taskToEdit?.clientId && !list.some(c => c.id === taskToEdit.clientId)) {
      const existingClient = allClients.find(c => c.id === taskToEdit.clientId);
      if (existingClient) {
        list = [existingClient, ...list];
      }
    }

    return list.length > 0 ? list : allClients;
  }, [canSeeAll, allClients, userClientIds, taskToEdit]);

  const [clientId, setClientId] = useState('');
  const [assignedToId, setAssignedToId] = useState('');
  const [particular, setParticular] = useState('');
  const [priority, setPriority] = useState<Priority>('Medium');
  const [assignedDate, setAssignedDate] = useState(todayInputDate());
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Pending');
  const [remarks, setRemarks] = useState('');
  const [managerComment, setManagerComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Effective client ID based on single-client vs dropdown
  const activeClientId = (!canSeeAll && availableClients.length === 1)
    ? availableClients[0].id
    : clientId;

  // Filter assignable users based on hierarchy rank and selected client
  const assignableUsers = useMemo(() => {
    if (mode !== 'team') return [];

    let list = getAssignableUsers(currentUser, allUsers, activeClientId);

    // If editing a task, preserve the current assignee in the options if they're not in the list (except Admin)
    if (taskToEdit?.assignedToId && !list.some(u => u.id === taskToEdit.assignedToId)) {
      const existingAssignee = allUsers.find(u => u.id === taskToEdit.assignedToId);
      if (existingAssignee && existingAssignee.role !== 'ADMIN' && existingAssignee.designation !== 'Admin') {
        list = [existingAssignee, ...list];
      }
    }

    return list;
  }, [currentUser, allUsers, activeClientId, mode, taskToEdit]);

  useEffect(() => {
    if (taskToEdit) {
      const editClient = (!canSeeAll && availableClients.length === 1)
        ? availableClients[0].id
        : (taskToEdit.clientId || availableClients[0]?.id || '');

      setClientId(editClient);
      setAssignedToId(taskToEdit.assignedToId || '');
      setParticular(taskToEdit.particular || '');
      setPriority(taskToEdit.priority || 'Medium');
      setAssignedDate(toInputDate(taskToEdit.assignedDate) || todayInputDate());
      setDeadline(toInputDate(taskToEdit.deadline) || '');
      setStatus(taskToEdit.status || 'Pending');
      setRemarks(taskToEdit.remarks || '');
      setManagerComment(taskToEdit.managerComment || '');
    } else {
      // New task defaults
      const defaultClient = availableClients[0]?.id || '';
      setClientId(defaultClient);
      setAssignedToId(mode === 'team' ? '' : (currentUser?.id || ''));
      setParticular('');
      setPriority('Medium');
      setAssignedDate(todayInputDate());
      setDeadline('');
      setStatus('Pending');
      setRemarks('');
      setManagerComment('');
    }
  }, [taskToEdit, isOpen, currentUser, availableClients, mode, canSeeAll]);

  // When in team mode, auto-select first assignable user if none is selected
  useEffect(() => {
    if (mode === 'team' && !taskToEdit) {
      if (assignableUsers.length > 0) {
        if (!assignedToId || !assignableUsers.some(u => u.id === assignedToId)) {
          setAssignedToId(assignableUsers[0].id);
        }
      } else {
        setAssignedToId('');
      }
    }
  }, [assignableUsers, mode, taskToEdit, assignedToId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!particular.trim()) {
      alert('Please provide particulars for the task.');
      return;
    }

    if (mode === 'team' && !assignedToId) {
      alert('Please select a team member to assign this task to.');
      return;
    }

    const finalClientId = (!canSeeAll && availableClients.length === 1)
      ? availableClients[0].id
      : (clientId || availableClients[0]?.id || '');

    setIsSubmitting(true);
    try {
      if (isEditing && taskToEdit) {
        await updateTask(taskToEdit.id, {
          clientId: finalClientId,
          assignedToId: mode === 'team' ? assignedToId : (taskToEdit.assignedToId || currentUser?.id || ''),
          particular,
          priority,
          assignedDate,
          deadline,
          status,
          remarks,
          managerComment
        });
      } else {
        await createTask({
          clientId: finalClientId,
          assignedToId: mode === 'team' ? assignedToId : (currentUser?.id || ''),
          particular,
          priority,
          assignedDate,
          deadline,
          status,
          remarks
        });
      }
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Task' : mode === 'team' ? 'Assign New Task' : 'New Task'}
    >
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          {/* Client selector (Single client displays as text; multiple clients display as scoped dropdown) */}
          <div className="form-field">
            <label>Client</label>
            {!canSeeAll && availableClients.length === 1 ? (
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
                required
              >
                <option value="">Select client…</option>
                {availableClients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.jobNumber ? `(${c.jobNumber})` : ''}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Assign To - STRICTLY only in team mode, NEVER in personal add task */}
          {mode === 'team' && (
            <div className="form-field">
              <label>Assign To</label>
              <select
                value={assignedToId}
                onChange={e => setAssignedToId(e.target.value)}
                className="form-select"
                required
              >
                <option value="">
                  {!activeClientId
                    ? 'Select a client first…'
                    : assignableUsers.length === 0
                    ? 'No eligible subordinates on this client'
                    : 'Select team member…'}
                </option>
                {assignableUsers.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.designation})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Particulars */}
          <div className="form-field">
            <label>Particulars</label>
            <textarea
              value={particular}
              onChange={e => setParticular(e.target.value)}
              className="form-textarea"
              placeholder="Describe the task or audit procedure to be performed..."
              required
            />
          </div>

          {/* Priority & Status */}
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
              <label>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as TaskStatus)}
                className="form-select"
              >
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          {/* Assigned Date & Deadline */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-field">
              <label>Assigned Date</label>
              <input
                type="date"
                value={assignedDate}
                onChange={e => setAssignedDate(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="form-field">
              <label>Deadline</label>
              <input
                type="date"
                value={deadline}
                onChange={e => setDeadline(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Employee Remarks */}
          <div className="form-field">
            <label>Remarks / Notes</label>
            <textarea
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="form-textarea"
              placeholder="Progress notes, missing documents, or remarks..."
            />
          </div>

          {/* Manager Comment View/Edit - Strictly for existing tasks, NEVER when adding a new task */}
          {isEditing && (
            isManager && taskToEdit?.assignedToId !== currentUser?.id ? (
              <div className="form-field">
                <label>Manager Comment</label>
                <textarea
                  value={managerComment}
                  onChange={e => setManagerComment(e.target.value)}
                  className="form-textarea"
                  placeholder="Guidance or review feedback for the team member..."
                />
              </div>
            ) : managerComment ? (
              <div className="form-field">
                <label>Manager Comment</label>
                <div className="comment-box">{managerComment}</div>
              </div>
            ) : null
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : isEditing ? 'Save Changes' : mode === 'team' ? 'Assign Task' : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
