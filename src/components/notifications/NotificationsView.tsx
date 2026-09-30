import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCheck,
  Clock,
  FileText,
  ClipboardList,
  MessageSquare,
  MessagesSquare,
  Send,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { notificationService } from '../../services/notificationService';
import { SendNotificationModal } from './SendNotificationModal';
import { QueryInboxModal } from './QueryInboxModal';
import { SendQueryModal } from './SendQueryModal';
import { ProfileInfoModal } from './ProfileInfoModal';
import { AppNotification, UserQuery } from '../../types';

import { StatPills } from '../dashboard/StatPills';

export const NotificationsView: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, refreshNotifications, isLoading } = useNotifications();
  const { currentUser } = useAuth();
  const [infoFor, setInfoFor] = useState<string | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [queryOpen, setQueryOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [openQueries, setOpenQueries] = useState<UserQuery[]>([]);
  const isAdmin = currentUser?.role === 'ADMIN';

  const loadQueries = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setOpenQueries(await notificationService.listQueries());
    } catch {
      setOpenQueries([]);
    }
  }, [isAdmin]);

  // Keep the Query count fresh (also reloads when a new notification arrives)
  useEffect(() => {
    loadQueries();
  }, [loadQueries, notifications.length]);

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Filter within 7 days
  const recentNotifications = notifications.filter(n => {
    try {
      // An unfilled info request stays in NEW until completed, however old
      if ((n.type === 'INFO_REQUEST' || n.type === 'USER_QUERY') && !n.isRead) return true;
      return new Date(n.createdAt).getTime() >= sevenDaysAgo;
    } catch {
      return true;
    }
  });

  const unreadList = recentNotifications.filter(n => !n.isRead);
  const readList = recentNotifications.filter(n => n.isRead);

  const totalNotifs = recentNotifications.length;
  const unreadNotifs = unreadList.length;
  const assignedNotifs = recentNotifications.filter(n => n.type === 'TASK_ASSIGNED').length;
  const deadlineNotifs = recentNotifications.filter(n => n.type === 'DEADLINE_ALERT').length;
  const commentNotifs = recentNotifications.filter(n => n.type === 'MANAGER_COMMENT' || n.type === 'TASK_REQUEST').length;

  const notifStats = [
    { label: 'TOTAL NOTICES', value: totalNotifs },
    { label: 'UNREAD', value: unreadNotifs, isOverdue: unreadNotifs > 0, valueColor: unreadNotifs > 0 ? '#991B1B' : undefined },
    { label: 'ASSIGNMENTS', value: assignedNotifs, valueColor: '#1E40AF' },
    { label: 'DEADLINES', value: deadlineNotifs, valueColor: deadlineNotifs > 0 ? '#B45309' : undefined },
    { label: 'COMMENTS', value: commentNotifs, valueColor: '#166534' }
  ];

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
      case 'INFO_REQUEST':
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
              background: '#FFFBEB',
              color: '#92400E',
              border: '1px solid #FDE68A'
            }}
          >
            <ClipboardList size={12} /> Info Request
          </span>
        );
      case 'USER_QUERY':
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
              background: '#F5F3FF',
              color: '#5B21B6',
              border: '1px solid #DDD6FE'
            }}
          >
            <MessagesSquare size={12} /> User Query
          </span>
        );
      case 'QUERY_RESOLVED':
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
              background: '#ECFDF5',
              color: '#065F46',
              border: '1px solid #A7F3D0'
            }}
          >
            <MessagesSquare size={12} /> Query Solved
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
    <div className="notifications-page" style={{ display: 'contents' }}>
      <StatPills items={notifStats} variant="maroon" />

      {sendOpen && (
        <SendNotificationModal
          onClose={() => setSendOpen(false)}
          onSent={() => {
            refreshNotifications();
          }}
        />
      )}

      {queryOpen && <SendQueryModal onClose={() => setQueryOpen(false)} />}

      {inboxOpen && (
        <QueryInboxModal
          queries={openQueries}
          onChanged={() => {
            loadQueries();
            refreshNotifications();
          }}
          onClose={() => setInboxOpen(false)}
        />
      )}

      {infoFor && (
        <ProfileInfoModal
          onClose={() => setInfoFor(null)}
          onDone={() => {
            markAsRead(infoFor);
            setInfoFor(null);
          }}
        />
      )}

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

          <div
            style={{
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              display: 'flex',
              gap: '8px'
            }}
          >
            {isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    loadQueries();
                    setInboxOpen(true);
                  }}
                  className="btn btn-sm"
                  style={{
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
                  <MessagesSquare size={14} /> Query
                  {openQueries.length > 0 && (
                    <span
                      style={{
                        background: '#ffffff',
                        color: 'var(--maroon)',
                        fontSize: '10.5px',
                        fontWeight: 800,
                        padding: '1px 7px',
                        borderRadius: '10px'
                      }}
                    >
                      {openQueries.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSendOpen(true)}
                  className="btn btn-sm"
                  style={{
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
                  <Send size={14} /> Send Notification
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setQueryOpen(true)}
                className="btn btn-sm"
                style={{
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
                <Send size={14} /> Send Query
              </button>
            )}
            {unreadList.length > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="btn btn-sm"
                style={{
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
                      {notif.type === 'USER_QUERY' ? (
                        <button
                          type="button"
                          onClick={() => {
                            loadQueries();
                            setInboxOpen(true);
                          }}
                          className="btn btn-primary btn-sm"
                          title="Open the query list to resolve it"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11.5px', fontWeight: 600 }}
                        >
                          <MessagesSquare size={14} /> Open queries
                        </button>
                      ) : notif.type === 'INFO_REQUEST' ? (
                        <button
                          type="button"
                          onClick={() => setInfoFor(notif.id)}
                          className="btn btn-primary btn-sm"
                          title="Fill in your information to complete this request"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '5px 10px', fontSize: '11.5px', fontWeight: 600 }}
                        >
                          <ClipboardList size={14} /> Update info
                        </button>
                      ) : (
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
                      )}
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
                        <CheckCheck size={14} color="#166534" /> {notif.type === 'INFO_REQUEST' ? 'Completed' : notif.type === 'USER_QUERY' ? 'Handled' : 'Read'}
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
