import React from 'react';
import { Task } from '../../types';
import { TaskTableRow } from './TaskTableRow';

interface TaskTableProps {
  title: string;
  tasks: Task[];
  bannerColor?: 'maroon' | 'teal' | 'navy';
  showTeamColumns?: boolean;
  isLoading?: boolean;
  emptyMessage?: string;
  onEditTask: (task: Task) => void;
  onOpenComment: (task: Task) => void;
}

export const TaskTable: React.FC<TaskTableProps> = ({
  title,
  tasks,
  bannerColor = 'maroon',
  showTeamColumns = false,
  isLoading = false,
  emptyMessage = 'No tasks found.',
  onEditTask,
  onOpenComment
}) => {
  const bannerClass = `banner-strip banner-${bannerColor}`;
  const tableClass = `data-table ${bannerColor}-table`;

  return (
    <div className="table-card">
      <div className={bannerClass}>
        <span>{title}</span>
      </div>

      <div className="table-responsive">
        <table className={tableClass}>
          <thead>
            <tr>
              <th style={{ width: '40px', minWidth: '40px', textAlign: 'center' }}>SL.</th>
              {showTeamColumns && (
                <th style={{ width: '12%', minWidth: '115px', textAlign: 'center' }}>Name</th>
              )}
              <th style={{ width: showTeamColumns ? '22%' : '26%', minWidth: '220px', textAlign: 'center' }}>Particulars</th>
              {showTeamColumns && (
                <th style={{ width: '12%', minWidth: '115px', textAlign: 'center' }}>Client</th>
              )}
              {!showTeamColumns && (
                <th style={{ width: '110px', minWidth: '100px', textAlign: 'center' }}>Added By</th>
              )}
              <th style={{ width: '75px', minWidth: '70px', textAlign: 'center' }}>Priority</th>
              <th style={{ width: '100px', minWidth: '95px', textAlign: 'center' }}>Deadline</th>
              <th style={{ width: '110px', minWidth: '100px', textAlign: 'center' }}>Status</th>
              <th style={{ width: '9%', minWidth: '85px', textAlign: 'center' }}>Remarks</th>
              <th style={{ width: '10%', minWidth: '95px', textAlign: 'center' }}>Manager Comment</th>
              <th style={{ width: '85px', minWidth: '80px', textAlign: 'center' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={showTeamColumns ? 10 : 9} style={{ textAlign: 'center', padding: 0 }}>
                  <div className="loading-indicator">
                    Loading tasks…
                  </div>
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={showTeamColumns ? 10 : 9} className="empty-state">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              tasks.map((task, idx) => (
                <TaskTableRow
                  key={`${task.id}-${idx}`}
                  task={task}
                  index={idx}
                  showTeamColumns={showTeamColumns}
                  onEditTask={onEditTask}
                  onOpenComment={onOpenComment}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
