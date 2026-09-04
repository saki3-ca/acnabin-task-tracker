import React from 'react';
import { DashboardStats } from '../../types';

interface StatPillsProps {
  stats: DashboardStats;
  variant?: 'maroon' | 'teal';
}

export const StatPills: React.FC<StatPillsProps> = ({ stats, variant = 'maroon' }) => {
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="stat-pills">
      <div className={`stat-pill ${variant === 'teal' ? 'teal-border' : ''}`}>
        <span className="stat-pill-label">TOTAL</span>
        <span className="stat-pill-value">{pad(stats.total)}</span>
      </div>

      <div className={`stat-pill ${variant === 'teal' ? 'teal-border' : ''}`}>
        <span className="stat-pill-label">PENDING</span>
        <span className="stat-pill-value">{pad(stats.pending)}</span>
      </div>

      <div className={`stat-pill ${variant === 'teal' ? 'teal-border' : ''}`}>
        <span className="stat-pill-label">IN PROGRESS</span>
        <span className="stat-pill-value">{pad(stats.inProgress)}</span>
      </div>

      <div className={`stat-pill ${variant === 'teal' ? 'teal-border' : ''}`}>
        <span className="stat-pill-label">COMPLETED</span>
        <span className="stat-pill-value">{pad(stats.completed)}</span>
      </div>

      <div className={`stat-pill ${variant === 'teal' ? 'teal-border' : ''}`}>
        <span className="stat-pill-label">OVERDUE</span>
        <span className="stat-pill-value overdue">{pad(stats.overdue)}</span>
      </div>
    </div>
  );
};
