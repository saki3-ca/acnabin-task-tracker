import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { adminService } from '../../services/adminService';
import { todayInputDate, toInputDate } from '../../lib/dateUtils';
import {
  canAssignTasks,
  canViewAllClients,
  getAssignableUsers,
  getSelectableClients,
  getUserAssignedClientIds,
  isAssistantDirectorOrAbove
} from '../../lib/permissions';
import { Priority, Task, TaskStatus, User } from '../../types';
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
  const { createTask, createTasksBulk, updateTask } = useTasks();

  const isEditing = Boolean(taskToEdit);
  const isManager = canAssignTasks(currentUser);
  const canSeeAll = canViewAllClients(currentUser);
  const isADPlus = currentUser ? (currentUser.role === 'ADMIN' || isAssistantDirectorOrAbove(currentUser.designation)) : false;

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

    let list = getSelectableClients(currentUser, allClients, adminService.getCachedManagerClientIds(currentUser?.id || '') || []);

    // When editing an existing task, preserve the task's existing client in the options
    if (taskToEdit?.clientId && !list.some(c => c.id === taskToEdit.clientId)) {
      const existingClient = allClients.find(c => c.id === taskToEdit.clientId);
      if (existingClient) {
        list = [existingClient, ...list];
      }
    }

    return list; // no fallback to every client: someone with no assigned client gets only "General"
  }, [canSeeAll, allClients, currentUser, taskToEdit]);

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
      const defaultClient = isADPlus ? 'ALL_CLIENTS' : (availableClients[0]?.id || '');
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
  }, [taskToEdit, isOpen, currentUser, availableClients, mode, canSeeAll, isADPlus]);

  // Firm-wide assignment by AD and above: only the "all below members" choice, no individual list
  const firmWideBulk = mode === 'team' && !taskToEdit && isADPlus && clientId === 'ALL_CLIENTS';

  // When in team mode, auto-select first assignable user if none is selected
  useEffect(() => {
    if (mode === 'team' && !taskToEdit) {
      if (firmWideBulk) {
        setAssignedToId(assignableUsers.length > 0 ? 'ALL_MEMBERS' : '');
      } else if (assignableUsers.length > 0) {
        if (!assignedToId || (assignedToId !== 'ALL_MEMBERS' && !assignableUsers.some(u => u.id === assignedToId))) {
          setAssignedToId(assignableUsers[0].id);
        }
      } else {
        setAssignedToId('');
      }
    }
  }, [assignableUsers, mode, taskToEdit, assignedToId, firmWideBulk]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!particular.trim()) {
      alert('Please provide particulars for the task.');
      return;
    }

    if (mode === 'team' && !assignedToId) {
      alert('Please select a team member or select All Members to assign this task.');
      return;
    }

    const finalClientId = (!canSeeAll && availableClients.length === 1)
      ? availableClients[0].id
      : (clientId || availableClients[0]?.id || '');

    const resolveClientForUser = (targetUser?: User | null) => {
      const isAllClientsSelected = !finalClientId || finalClientId === 'ALL_CLIENTS' || finalClientId === 'all';

      // A specific client chosen from the dropdown always wins, including for bulk
      // ALL_MEMBERS (AD+ subordinates are eligible for any client, so their own
      // primary client must not override the selection).
      if (!isAllClientsSelected && finalClientId !== 'general') {
        const found = availableClients.find(c => c.id === finalClientId) || allClients.find(c => c.id === finalClientId);
        if (found) return { id: found.id, name: found.name };
      }

      // If target user is known, resolve to the user's assigned client:
      if (targetUser) {
        const userClientIds = getUserAssignedClientIds(targetUser);
        if (userClientIds.length > 0) {
          // If a specific client was selected and the user actually belongs to it, prioritize that client
          if (!isAllClientsSelected && userClientIds.includes(finalClientId)) {
            const found = allClients.find(c => c.id === finalClientId);
            if (found) return { id: found.id, name: found.name };
          }
          // Otherwise, if user has multiple clients, show in one (the first / primary assigned client)
          const primaryId = userClientIds[0];
          const found = allClients.find(c => c.id === primaryId);
          if (found) return { id: found.id, name: found.name };
          return { id: primaryId, name: primaryId };
        }
      }

      // If the user has no assigned clients, check if a specific client was selected
      if (!isAllClientsSelected && finalClientId !== 'general') {
        const found = availableClients.find(c => c.id === finalClientId) || allClients.find(c => c.id === finalClientId);
        if (found) return { id: found.id, name: found.name };
      }

      return { id: 'general', name: 'General' };
    };

    setIsSubmitting(true);
    try {
      if (isEditing && taskToEdit) {
        const targetUser = mode === 'team'
          ? (assignableUsers.find(u => u.id === assignedToId) || allUsers.find(u => u.id === assignedToId))
          : currentUser;
        // Keep the task's existing client (e.g. 'general') unless the user changed it.
        const resolvedClient = taskToEdit.clientId && finalClientId === taskToEdit.clientId
          ? { id: taskToEdit.clientId, name: taskToEdit.clientName || 'General' }
          : resolveClientForUser(targetUser);
        await updateTask(taskToEdit.id, {
          clientId: resolvedClient.id,
          clientName: resolvedClient.name,
          assignedToId: mode === 'team' ? assignedToId : (taskToEdit.assignedToId || currentUser?.id || ''),
          particular,
          priority,
          assignedDate,
          deadline,
          status,
          remarks,
          managerComment
        });
      } else if (mode === 'team' && assignedToId === 'ALL_MEMBERS') {
        const tasksToCreate = assignableUsers.map(u => {
          const clientInfo = resolveClientForUser(u);
          return {
            clientId: clientInfo.id,
            clientName: clientInfo.name,
            assignedToId: u.id,
            assignedToName: u.name,
            particular,
            priority,
            assignedDate,
            deadline,
            status,
            remarks,
            managerComment
          };
        });
        await createTasksBulk(tasksToCreate);
      } else {
        const targetUser = mode === 'team'
          ? (assignableUsers.find(u => u.id === assignedToId) || allUsers.find(u => u.id === assignedToId))
          : currentUser;
        const resolvedClient = resolveClientForUser(targetUser);
        await createTask({
          clientId: resolvedClient.id,
          clientName: resolvedClient.name,
          assignedToId: mode === 'team' ? assignedToId : (currentUser?.id || ''),
          particular,
          priority,
          assignedDate,
          deadline,
          status,
          remarks,
          managerComment
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
            {!canSeeAll && availableClients.length === 0 ? (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-soft)',
                  border: '1.5px solid var(--line-strong)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 600,
                  color: 'var(--ink-soft)'
                }}
              >
                General (no client is assigned to you)
              </div>
            ) : !canSeeAll && availableClients.length === 1 ? (
              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-soft)',
                  border: '1.5px solid var(--line-strong)',
                  fontSize: 'var(--text-base)',
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
                {isADPlus && (
                  <option value="ALL_CLIENTS" style={{ fontWeight: 600, color: '#1E40AF' }}>
                    🌐 All Clients / Firm-wide
                  </option>
                )}
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
                    ? 'No eligible subordinates found'
                    : 'Select team member…'}
                </option>
                {isADPlus && !isEditing && assignableUsers.length > 0 && (
                  <option
                    value="ALL_MEMBERS"
                    style={{ fontWeight: 600, color: '#1E40AF', background: '#EFF6FF' }}
                  >
                    👥 Assign to ALL Below Members ({assignableUsers.length} members)
                  </option>
                )}
                {assignableUsers.length > 0 && !firmWideBulk && (
                  <optgroup label="Individual Team Members">
                    {assignableUsers.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.designation})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              {assignedToId === 'ALL_MEMBERS' && (
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    color: '#1E40AF',
                    marginTop: '5px',
                    padding: '6px 10px',
                    background: '#EFF6FF',
                    borderRadius: '4px',
                    border: '1px solid #BFDBFE',
                    lineHeight: '1.4'
                  }}
                >
                  ⚡ <strong>Bulk Assignment Active:</strong> This task will be simultaneously created and assigned to all <strong>{assignableUsers.length}</strong> subordinate team members ({clientId === 'ALL_CLIENTS' ? 'firm-wide' : 'assigned to this client'}).
                </div>
              )}
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
            {isSubmitting
              ? 'Saving…'
              : isEditing
              ? 'Save Changes'
              : mode === 'team'
              ? assignedToId === 'ALL_MEMBERS'
                ? `Assign to All (${assignableUsers.length}) Members`
                : 'Assign Task'
              : 'Create Task'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
