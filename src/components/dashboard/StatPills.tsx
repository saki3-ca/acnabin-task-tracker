import React from 'react';
import { DashboardStats } from '../../types';

interface StatPillsProps {
  stats: DashboardStats;
  variant?: 'maroon' | 'teal';
  onPillClick?: (status: 'TOTAL' | 'PENDING' | 'IN PROGRESS' | 'COMPLETED' | 'OVERDUE') => void;
}

export const StatPills: React.FC<StatPillsProps> = ({ stats, variant = 'maroon', onPillClick }) => {
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="stat-pills">
      <div
        className={`stat-pill ${variant === 'teal' ? 'teal-border' : ''}`}
        onClick={() => onPillClick?.('TOTAL')}
      >
        <span className="stat-pill-label">TOTAL</span>
        <span className="stat-pill-value">{pad(stats.total)}</span>
      </div>

      <div
        className={`stat-pill ${variant === 'teal' ? 'teal-border' : ''}`}
        onClick={() => onPillClick?.('PENDING')}
      >
        <span className="stat-pill-label">PENDING</span>
        <span className="stat-pill-value">{pad(stats.pending)}</span>
      </div>

      <div
        className={`stat-pill ${variant === 'teal' ? 'teal-border' : ''}`}
        onClick={() => onPillClick?.('IN PROGRESS')}
      >
        <span className="stat-pill-label">IN PROGRESS</span>
        <span className="stat-pill-value">{pad(stats.inProgress)}</span>
      </div>

      <div
        className={`stat-pill ${variant === 'teal' ? 'teal-border' : ''} ${onPillClick ? 'clickable' : ''}`}
        onClick={() => onPillClick?.('COMPLETED')}
        style={onPillClick ? { cursor: 'pointer', transition: 'transform 0.15s ease, box-shadow 0.15s ease' } : undefined}
        title={onPillClick ? 'Click to view completed tasks archive' : undefined}
      >
        <span className="stat-pill-label">COMPLETED</span>
        <span className="stat-pill-value" style={{ color: '#166534' }}>{pad(stats.completed)}</span>
      </div>

      <div
        className={`stat-pill ${variant === 'teal' ? 'teal-border' : ''}`}
        onClick={() => onPillClick?.('OVERDUE')}
      >
        <span className="stat-pill-label">OVERDUE</span>
        <span className="stat-pill-value overdue">{pad(stats.overdue)}</span>
      </div>
    </div>
  );
};
