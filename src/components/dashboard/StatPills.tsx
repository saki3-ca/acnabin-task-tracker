import React from 'react';
import { DashboardStats } from '../../types';

export interface StatPillCustomItem {
  label: string;
  value: number | string;
  isOverdue?: boolean;
  valueColor?: string;
  onClick?: () => void;
  title?: string;
}

interface StatPillsProps {
  stats?: DashboardStats;
  items?: StatPillCustomItem[];
  variant?: 'maroon' | 'teal' | 'navy';
  onPillClick?: (status: 'TOTAL' | 'PENDING' | 'IN PROGRESS' | 'COMPLETED' | 'OVERDUE') => void;
}

export const StatPills: React.FC<StatPillsProps> = ({ stats, items, variant = 'maroon', onPillClick }) => {
  const pad = (n: number | string) => {
    if (typeof n === 'number') return String(n).padStart(2, '0');
    return String(n);
  };

  const borderClass = variant === 'teal' ? 'teal-border' : variant === 'navy' ? 'navy-border' : '';

  if (items && items.length > 0) {
    return (
      <div className="stat-pills">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`stat-pill ${borderClass} ${item.onClick ? 'clickable' : ''}`}
            onClick={item.onClick}
            style={item.onClick ? { cursor: 'pointer' } : undefined}
            title={item.title}
          >
            <span className="stat-pill-label">{item.label}</span>
            <span
              className={`stat-pill-value ${item.isOverdue ? 'overdue' : ''}`}
              style={item.valueColor ? { color: item.valueColor } : undefined}
            >
              {pad(item.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  const s = stats || { total: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0 };

  return (
    <div className="stat-pills">
      <div
        className={`stat-pill ${borderClass}`}
        onClick={() => onPillClick?.('TOTAL')}
      >
        <span className="stat-pill-label">TOTAL</span>
        <span className="stat-pill-value">{pad(s.total)}</span>
      </div>

      <div
        className={`stat-pill ${borderClass}`}
        onClick={() => onPillClick?.('PENDING')}
      >
        <span className="stat-pill-label">PENDING</span>
        <span className="stat-pill-value">{pad(s.pending)}</span>
      </div>

      <div
        className={`stat-pill ${borderClass}`}
        onClick={() => onPillClick?.('IN PROGRESS')}
      >
        <span className="stat-pill-label">IN PROGRESS</span>
        <span className="stat-pill-value">{pad(s.inProgress)}</span>
      </div>

      <div
        className={`stat-pill ${borderClass} ${onPillClick ? 'clickable' : ''}`}
        onClick={() => onPillClick?.('COMPLETED')}
        style={onPillClick ? { cursor: 'pointer' } : undefined}
        title={onPillClick ? 'Click to view completed tasks archive' : undefined}
      >
        <span className="stat-pill-label">COMPLETED</span>
        <span className="stat-pill-value" style={{ color: '#166534' }}>{pad(s.completed)}</span>
      </div>

      <div
        className={`stat-pill ${borderClass}`}
        onClick={() => onPillClick?.('OVERDUE')}
      >
        <span className="stat-pill-label">OVERDUE</span>
        <span className="stat-pill-value overdue">{pad(s.overdue)}</span>
      </div>
    </div>
  );
};
