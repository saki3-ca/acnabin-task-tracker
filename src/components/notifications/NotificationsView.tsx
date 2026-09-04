import React from 'react';
import {
  AlertCircle,
  Bell,
  CheckCheck,
  Clock,
  FileText,
  MessageSquare,
  UserCheck
} from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import { AppNotification } from '../../types';

export const NotificationsView: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, isLoading } = useNotifications();

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Filter within 7 days
  const recentNotifications = notifications.filter(n => {
    try {
      return new Date(n.createdAt).getTime() >= sevenDaysAgo;
    } catch {
      return true;
    }
  });

  const unreadList = recentNotifications.filter(n => !n.isRead);
  const readList = recentNotifications.filter(n => n.isRead);

  const formatTimestamp = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  const renderTypeBadge = (type: AppNotification['type']) => {
    switch (type) {
      case 'TASK_ASSIGNED':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              background: '#EBF4FF',
              color: '#1E40AF',
              border: '1px solid #BFDBFE'
            }}
          >
            <UserCheck size={12} /> Task Assigned
          </span>
        );
      case 'DEADLINE_ALERT':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              background: '#FEF2F2',
              color: '#991B1B',
              border: '1px solid #FECACA'
            }}
          >
            <AlertCircle size={12} /> Deadline Alert
          </span>
        );
      case 'MANAGER_COMMENT':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              background: '#F0FDF4',
              color: '#166534',
              border: '1px solid #BBF7D0'
            }}
          >
            <MessageSquare size={12} /> Manager Comment
          </span>
        );
      case 'TASK_REQUEST':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              background: '#FFF1F2',
              color: '#9F1239',
              border: '1px solid #FECDD3'
            }}
          >
            <FileText size={12} /> Task Request
          </span>
        );
      default:
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 700,
              background: '#F1F5F9',
              color: '#334155'
            }}
          >
            <Bell size={12} /> General
          </span>
        );
    }
  };

  return (
    <div className="notifications-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* SECTION 1: Red Table - New / Unread Notifications */}
      <div className="table-card">
        <div className="banner-strip banner-maroon">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <span>NEW / UNREAD NOTIFICATIONS</span>
            {unreadList.length > 0 && (
              <span
                style={{
                  background: '#ffffff',
                  color: 'var(--maroon)',
                  fontSize: '11px',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px'
                }}
              >
                {unreadList.length} NEW
              </span>
            )}
          </div>

          {unreadList.length > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="btn btn-sm"
              style={{
                position: 'absolute',
                right: '16px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                fontSize: '11.5px',
                cursor: 'pointer'
              }}
            >
              <CheckCheck size={14} /> Mark all read
            </button>
          )}
        </div>

        <div className="table-responsive" style={{ minHeight: '170px' }}>
          <table className="data-table maroon-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>SL.</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Category</th>
                <th style={{ textAlign: 'left', paddingLeft: '16px' }}>Notification Details</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Received</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '24px', height: '133px' }}>
                    <div className="loading-indicator">Loading notifications…</div>
                  </td>
                </tr>
              ) : unreadList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state" style={{ padding: '31px 16px', textAlign: 'center', height: '133px' }}>
                    <CheckCheck size={28} style={{ color: '#166534', marginBottom: '6px' }} />
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)' }}>
                      No new notifications!
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: '3px' }}>
                      You are completely caught up. Read notifications are listed below.
                    </div>
                  </td>
                </tr>
              ) : (
                unreadList.map((notif, idx) => (
                  <tr key={notif.id} style={{ background: '#FFFDF9' }}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--ink-muted)' }}>
                      {idx + 1}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {renderTypeBadge(notif.type)}
                    </td>
                    <td style={{ paddingLeft: '16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--navy)', marginBottom: '3px' }}>
                        {notif.title}
                      </div>
                      <div style={{ fontSize: '12.5px', color: 'var(--ink)', lineHeight: '1.4' }}>
                        {notif.message}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '11.5px', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} /> {formatTimestamp(notif.createdAt)}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => markAsRead(notif.id)}
                        className="btn btn-teal btn-sm"
                        title="Mark as read (send to Previous Notifications)"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          padding: '5px 10px',
                          fontSize: '11.5px',
                          fontWeight: 600
                        }}
                      >
                        <CheckCheck size={14} /> Read
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Green / Teal Table - Previous Notifications (Read) */}
      <div className="table-card">
        <div className="banner-strip banner-teal">
          <span>PREVIOUS NOTIFICATIONS (PAST 7 DAYS)</span>
        </div>

        <div className="table-responsive" style={{ minHeight: '110px' }}>
          <table className="data-table teal-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>SL.</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Category</th>
                <th style={{ textAlign: 'left', paddingLeft: '16px' }}>Notification Details</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Received</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {readList.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state" style={{ padding: '26px 16px', textAlign: 'center', height: '73px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--ink-muted)' }}>
                      No previous read notifications in the last 7 days.
                    </div>
                  </td>
                </tr>
              ) : (
                readList.map((notif, idx) => (
                  <tr key={notif.id}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--ink-muted)' }}>
                      {idx + 1}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {renderTypeBadge(notif.type)}
                    </td>
                    <td style={{ paddingLeft: '16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--navy)', marginBottom: '3px' }}>
                        {notif.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--ink-soft)', lineHeight: '1.35' }}>
                        {notif.message}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '11.5px', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                      {formatTimestamp(notif.createdAt)}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: '#166534',
                          fontWeight: 600,
                          fontSize: '11.5px'
                        }}
                      >
                        <CheckCheck size={14} color="#166534" /> Read
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
