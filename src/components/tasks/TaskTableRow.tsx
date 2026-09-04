import React from 'react';
import { AlertCircle, Clock, Edit2, MessageSquare, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { daysUntilDeadline, fmtDate, isNearDeadline, isOverdue } from '../../lib/dateUtils';
import { canCommentOnTask, canDeleteTask, canEditTask } from '../../lib/permissions';
import { Task, TaskStatus } from '../../types';

interface TaskTableRowProps {
  task: Task;
  index: number;
  showTeamColumns?: boolean;
  onEditTask: (task: Task) => void;
  onOpenComment: (task: Task) => void;
}

export const TaskTableRow: React.FC<TaskTableRowProps> = ({
  task,
  index,
  showTeamColumns = false,
  onEditTask,
  onOpenComment
}) => {
  const { currentUser } = useAuth();
  const { updateTask, deleteTask } = useTasks();

  const overdue = isOverdue(task.deadline, task.status);
  const nearDeadline = isNearDeadline(task.deadline, task.status);
  const daysLeft = daysUntilDeadline(task.deadline);

  const canEdit = canEditTask(currentUser, task, showTeamColumns);
  const canComment = canCommentOnTask(currentUser, task);

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as TaskStatus;
    await updateTask(task.id, { status: newStatus });
  };

  const handleDelete = async () => {
    if (window.confirm(`Are you sure you want to delete task "${task.particular}"?`)) {
      await deleteTask(task.id);
    }
  };

  const statusClass = () => {
    if (overdue) return 'status-pill overdue';
    if (task.status === 'In Progress') return 'status-pill in-progress';
    if (task.status === 'Completed') return 'status-pill completed';
    return 'status-pill pending';
  };

  const priorityClass = () => {
    const p = task.priority?.toLowerCase() || 'medium';
    return `priority-pill ${p}`;
  };

  return (
    <tr className={overdue ? 'table-row-overdue' : ''}>
      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--ink-muted)' }}>
        {index + 1}
      </td>

      {showTeamColumns && (
        <>
          <td style={{ fontWeight: 600, color: 'var(--navy)' }}>
            {task.assignedToName || '—'}
          </td>
          <td style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>
            {task.clientName || 'General'}
          </td>
        </>
      )}

      {/* Particulars */}
      <td style={{ minWidth: '190px' }}>
        <div style={{ fontWeight: 600, color: 'var(--ink)', lineHeight: '1.3' }}>
          {task.particular}
        </div>
        {task.assignedDate && (
          <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '3px' }}>
            Assigned: {fmtDate(task.assignedDate)}
          </div>
        )}
      </td>

      {/* Added By - Only displayed in personal tasks, hidden in Team Engagement view */}
      {!showTeamColumns && (
        <td style={{ fontSize: '12px', color: 'var(--ink-soft)', whiteSpace: 'nowrap', textAlign: 'center' }}>
          {task.createdByName || '—'}
        </td>
      )}

      {/* Priority */}
      <td style={{ textAlign: 'center' }}>
        <span className={priorityClass()}>{task.priority}</span>
      </td>

      {/* Deadline */}
      <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
        <div style={{ fontWeight: overdue ? 700 : 500, color: overdue ? '#C53030' : 'var(--ink)' }}>
          {fmtDate(task.deadline)}
        </div>
        {overdue && (
          <span style={{ fontSize: '10.5px', color: '#991B1B', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px', marginTop: '2px' }}>
            <AlertCircle size={12} /> Overdue by {Math.abs(daysLeft || 0)}d
          </span>
        )}
        {!overdue && nearDeadline && (
          <span style={{ fontSize: '10.5px', color: '#B45309', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '3px', marginTop: '2px' }}>
            <Clock size={12} /> {daysLeft === 0 ? 'Due Today' : `Due in ${daysLeft}d`}
          </span>
        )}
      </td>

      {/* Status: editable by creator or in personal view; read-only pill in Team View if not creator */}
      <td style={{ textAlign: 'center' }}>
        {showTeamColumns && !canEdit ? (
          <span className={statusClass()}>{task.status}</span>
        ) : (
          <select
            value={task.status}
            onChange={handleStatusChange}
            className={statusClass()}
            style={{
              cursor: 'pointer',
              border: 'none',
              outline: 'none',
              fontSize: '11px',
              fontWeight: 600
            }}
          >
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
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

      {/* Manager Comment */}
      <td style={{ fontSize: '12px' }}>
        {task.managerComment ? (
          <div className="comment-box" style={{ fontSize: '11.5px', padding: '6px 10px', lineHeight: '1.35' }}>
            {task.managerComment}
          </div>
        ) : (
          <span style={{ color: 'var(--ink-muted)' }}>—</span>
        )}
      </td>

      {/* Actions */}
      <td style={{ whiteSpace: 'nowrap', textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
          {canEdit && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => onEditTask(task)}
              title="Edit Task"
              style={{ padding: '5px 8px' }}
            >
              <Edit2 size={13} />
            </button>
          )}

          {canComment && (
            <button
              className="btn btn-teal btn-sm"
              onClick={() => onOpenComment(task)}
              title="Add / Edit Comment"
              style={{ padding: '5px 8px' }}
            >
              <MessageSquare size={13} />
            </button>
          )}

          {canDeleteTask(currentUser, task) && (
            <button
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              title="Delete Task"
              style={{ padding: '5px 8px' }}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
};
