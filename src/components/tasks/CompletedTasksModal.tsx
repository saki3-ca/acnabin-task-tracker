import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Building,
  CheckCircle2,
  Clock,
  Edit2,
  FileText,
  Filter,
  MessageSquare,
  RotateCcw,
  Search,
  Trash2,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { fmtDate } from '../../lib/dateUtils';
import { canCommentOnTask, canDeleteTask, canEditTask } from '../../lib/permissions';
import { Task, TaskStatus } from '../../types';
import { Modal } from '../ui/Modal';

interface CompletedTasksModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  title?: string;
  showTeamColumns?: boolean;
  onEditTask?: (task: Task) => void;
  onOpenComment?: (task: Task) => void;
}

export const CompletedTasksModal: React.FC<CompletedTasksModalProps> = ({
  isOpen,
  onClose,
  tasks,
  title = 'Completed Tasks Archive',
  showTeamColumns = false,
  onEditTask,
  onOpenComment
}) => {
  const { currentUser } = useAuth();
  const { updateTask, deleteTask } = useTasks();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState('');

  // Extract unique client list from the completed tasks
  const clientOptions = useMemo(() => {
    const clients = new Map<string, string>();
    tasks.forEach(t => {
      if (t.clientId && t.clientName) {
        clients.set(t.clientId, t.clientName);
      }
    });
    return Array.from(clients.entries()).map(([id, name]) => ({ id, name }));
  }, [tasks]);

  // Filter tasks based on search & client
  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      const matchesSearch =
        !searchQuery.trim() ||
        t.particular.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.clientName && t.clientName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.createdByName && t.createdByName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.remarks && t.remarks.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (t.managerComment && t.managerComment.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesClient = !selectedClient || t.clientId === selectedClient;

      return matchesSearch && matchesClient;
    });
  }, [tasks, searchQuery, selectedClient]);

  const handleStatusChange = async (task: Task, newStatus: TaskStatus) => {
    await updateTask(task.id, { status: newStatus });
  };

  const handleReopen = async (task: Task) => {
    await updateTask(task.id, { status: 'In Progress' });
  };

  const handleDelete = async (task: Task) => {
    if (window.confirm(`Are you sure you want to delete completed task "${task.particular}"?`)) {
      await deleteTask(task.id);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="960px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '78vh' }}>
        {/* Header Summary & Filter Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            background: '#F0FDF4',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid #BBF7D0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: '#DCFCE7',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: '#166534' }}>
                {tasks.length} Completed {tasks.length === 1 ? 'Task' : 'Tasks'}
              </div>
              <div style={{ fontSize: '11.5px', color: '#15803D' }}>
                Archived completed assignments and engagements
              </div>
            </div>
          </div>

          {/* Controls: Search & Client Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '220px' }}>
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--ink-muted)'
                }}
              />
              <input
                type="text"
                placeholder="Search completed tasks..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="form-input"
                style={{
                  paddingLeft: '30px',
                  paddingTop: '6px',
                  paddingBottom: '6px',
                  fontSize: '12px',
                  height: '34px',
                  background: '#FFFFFF'
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    color: 'var(--ink-muted)'
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Client Filter Dropdown */}
            {clientOptions.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={14} color="var(--ink-soft)" />
                <select
                  value={selectedClient}
                  onChange={e => setSelectedClient(e.target.value)}
                  className="form-select"
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    height: '34px',
                    width: 'auto',
                    minWidth: '150px',
                    background: '#FFFFFF'
                  }}
                >
                  <option value="">All Clients</option>
                  {clientOptions.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Table Container */}
        <div
          className="table-responsive"
          style={{
            maxHeight: '52vh',
            overflowY: 'auto',
            border: '1px solid var(--line)',
            borderRadius: '8px'
          }}
        >
          <table className="data-table teal-table" style={{ margin: 0 }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={{ width: '45px', textAlign: 'center' }}>SL.</th>
                {showTeamColumns && (
                  <th style={{ width: '130px', textAlign: 'center' }}>Assigned To</th>
                )}
                <th style={{ minWidth: '200px', textAlign: 'left' }}>Particulars</th>
                <th style={{ width: '150px', textAlign: 'left' }}>Client</th>
                <th style={{ width: '105px', textAlign: 'center' }}>Deadline</th>
                <th style={{ width: '115px', textAlign: 'center' }}>Status</th>
                <th style={{ minWidth: '160px', textAlign: 'left' }}>Remarks</th>
                <th style={{ width: '90px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={showTeamColumns ? 8 : 7} className="empty-state" style={{ padding: '36px 16px', textAlign: 'center' }}>
                    <CheckCircle2 size={32} style={{ color: '#166534', opacity: 0.4, marginBottom: '8px' }} />
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)' }}>
                      {tasks.length === 0 ? 'No completed tasks found' : 'No completed tasks match your search'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: '4px' }}>
                      {tasks.length === 0
                        ? 'When tasks are marked as "Completed", they will be safely archived here.'
                        : 'Try clearing your search query or client filter.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task, idx) => {
                  const canEdit = canEditTask(currentUser, task, showTeamColumns);

                  return (
                    <tr key={task.id} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#F9FBFA' }}>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--ink-muted)' }}>
                        {idx + 1}
                      </td>

                      {/* Team Member (if showTeamColumns) */}
                      {showTeamColumns && (
                        <td style={{ fontSize: '12px', fontWeight: 600, color: 'var(--navy)', textAlign: 'center' }}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'var(--cream)',
                              border: '1px solid var(--line-soft)',
                              maxWidth: '120px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={task.assignedToName || 'Unassigned'}
                          >
                            {task.assignedToName || 'Unassigned'}
                          </span>
                        </td>
                      )}

                      {/* Particulars */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '13px', lineHeight: '1.35' }}>
                          {task.particular}
                        </div>
                        {task.assignedDate && (
                          <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '3px' }}>
                            Assigned: {fmtDate(task.assignedDate)}
                          </div>
                        )}
                      </td>

                      {/* Client */}
                      <td style={{ fontSize: '12.5px', color: 'var(--navy)', fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Building size={13} color="var(--ink-soft)" />
                          <span>{task.clientName || 'General'}</span>
                        </div>
                      </td>

                      {/* Deadline */}
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'center', fontSize: '12px', color: 'var(--ink-soft)' }}>
                        {fmtDate(task.deadline)}
                      </td>

                      {/* Status / Reopen Dropdown */}
                      <td style={{ textAlign: 'center' }}>
                        {canEdit ? (
                          <select
                            value={task.status}
                            onChange={e => handleStatusChange(task, e.target.value as TaskStatus)}
                            className="status-pill completed"
                            style={{
                              cursor: 'pointer',
                              border: 'none',
                              outline: 'none',
                              fontSize: '11px',
                              fontWeight: 700
                            }}
                            title="Change status to reopen task"
                          >
                            <option value="Completed">Completed</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Pending">Pending</option>
                          </select>
                        ) : (
                          <span className="status-pill completed">Completed</span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
                        {task.remarks ? (
                          <div style={{ wordBreak: 'break-word', lineHeight: '1.35' }}>{task.remarks}</div>
                        ) : (
                          <span style={{ color: 'var(--ink-muted)' }}>—</span>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          {canEdit && (
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleReopen(task)}
                              title="Reopen Task (Set to In Progress)"
                              style={{ padding: '5px 7px', color: '#166534', borderColor: '#BBF7D0' }}
                            >
                              <RotateCcw size={12} />
                            </button>
                          )}

                          {canDeleteTask(currentUser, task) && (
                            <button
                              className="btn btn-danger btn-sm"
                              onClick={() => handleDelete(task)}
                              title="Delete Task"
                              style={{ padding: '5px 7px' }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '4px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Close Archive
          </button>
        </div>
      </div>
    </Modal>
  );
};
