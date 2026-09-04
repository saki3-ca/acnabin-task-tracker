import React, { useState } from 'react';
import { Check, X, Clock, AlertCircle, FileText, UserCheck, Briefcase } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { useTasks } from '../../context/TaskContext';
import { taskRequestService } from '../../services/taskRequestService';
import { fmtDate } from '../../lib/dateUtils';
import { TaskRequest } from '../../types';

export const TaskRequestsView: React.FC = () => {
  const { currentUser } = useAuth();
  const { taskRequests, refreshRequests, refreshNotifications } = useNotifications();
  const { fetchTasks } = useTasks();
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (!currentUser) return null;

  // Requests where current user is the superior (Incoming requests to review)
  const incomingRequests = taskRequests.filter(r => r.superiorId === currentUser.id);

  // Requests where current user is the requester (Outgoing requests sent to superiors)
  const outgoingRequests = taskRequests.filter(r => r.requesterId === currentUser.id);

  const handleRespond = async (requestId: string, status: 'ACCEPTED' | 'DECLINED') => {
    const actionText = status === 'ACCEPTED' ? 'accept' : 'decline';
    if (!window.confirm(`Are you sure you want to ${actionText} this task request?`)) return;

    setProcessingId(requestId);
    try {
      await taskRequestService.respondTaskRequest(requestId, status);
      await Promise.all([refreshRequests(), refreshNotifications(), fetchTasks()]);
    } catch (e) {
      console.error('Failed to respond to request', e);
      alert('Failed to respond to task request.');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: TaskRequest['status']) => {
    switch (status) {
      case 'ACCEPTED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: '#E0EFEA', color: '#11534D' }}>
            Accepted
          </span>
        );
      case 'DECLINED':
        return (
          <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: '#FEE2E2', color: '#991B1B' }}>
            Declined
          </span>
        );
      default:
        return (
          <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 700, background: '#FEF3C7', color: '#92400E' }}>
            Pending Review
          </span>
        );
    }
  };

  return (
    <div className="task-requests-container" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* SECTION 1: Incoming Requests Awaiting Superior Decision */}
      <div className="table-card">
        <div className="banner-strip banner-maroon">
          <span>INCOMING TASK REQUESTS (FOR YOUR DECISION)</span>
        </div>

        <div className="table-responsive" style={{ minHeight: '170px' }}>
          <table className="data-table maroon-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>SL.</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Requester</th>
                <th style={{ textAlign: 'left', paddingLeft: '16px' }}>Request Details</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Client / Deadline</th>
                <th style={{ width: '180px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {incomingRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state" style={{ padding: '31px 16px', textAlign: 'center', height: '133px' }}>
                    <FileText size={28} style={{ color: 'var(--maroon)', marginBottom: '6px', opacity: 0.7 }} />
                    <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--ink)' }}>
                      No incoming task requests!
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: '3px' }}>
                      When team members request a task from you, it will appear here for review.
                    </div>
                  </td>
                </tr>
              ) : (
                incomingRequests.map((req, idx) => (
                  <tr key={req.id} style={{ background: req.status === 'PENDING' ? '#FFFDF9' : '#FFFFFF' }}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--ink-muted)' }}>
                      {idx + 1}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{req.requesterName}</div>
                      <div style={{ marginTop: '2px' }}>{getStatusBadge(req.status)}</div>
                    </td>
                    <td style={{ paddingLeft: '16px' }}>
                      <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--ink)', marginBottom: '3px' }}>
                        {req.particular}
                      </div>
                      {req.notes && (
                        <div style={{ fontSize: '12px', color: 'var(--ink-soft)', lineHeight: '1.35' }}>
                          <strong>Notes:</strong> {req.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '11.5px', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: 'var(--teal)' }}>{req.clientName}</div>
                      {req.deadline && (
                        <div style={{ fontSize: '11px', color: 'var(--maroon)', marginTop: '2px' }}>
                          Due: {fmtDate(req.deadline)}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {req.status === 'PENDING' ? (
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-teal btn-sm"
                            disabled={processingId === req.id}
                            onClick={() => handleRespond(req.id, 'ACCEPTED')}
                            style={{ padding: '4px 8px', fontSize: '11.5px' }}
                          >
                            <Check size={13} /> Accept
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            disabled={processingId === req.id}
                            onClick={() => handleRespond(req.id, 'DECLINED')}
                            style={{ padding: '4px 8px', fontSize: '11.5px' }}
                          >
                            <X size={13} /> Decline
                          </button>
                        </div>
                      ) : (
                        getStatusBadge(req.status)
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 2: Outgoing Requests (Submitted by Current User) */}
      <div className="table-card">
        <div className="banner-strip banner-teal">
          <span>YOUR SUBMITTED TASK REQUESTS</span>
        </div>

        <div className="table-responsive" style={{ minHeight: '110px' }}>
          <table className="data-table teal-table">
            <thead>
              <tr>
                <th style={{ width: '40px', textAlign: 'center' }}>SL.</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Superior</th>
                <th style={{ textAlign: 'left', paddingLeft: '16px' }}>Request Details</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Client / Deadline</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {outgoingRequests.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-state" style={{ padding: '26px 16px', textAlign: 'center', height: '73px' }}>
                    <div style={{ fontSize: '13px', color: 'var(--ink-muted)' }}>
                      You have not submitted any task requests.
                    </div>
                  </td>
                </tr>
              ) : (
                outgoingRequests.map((req, idx) => (
                  <tr key={req.id}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--ink-muted)' }}>
                      {idx + 1}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--navy)', whiteSpace: 'nowrap' }}>
                      {req.superiorName}
                    </td>
                    <td style={{ paddingLeft: '16px' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)', marginBottom: '3px' }}>
                        {req.particular}
                      </div>
                      {req.notes && (
                        <div style={{ fontSize: '12px', color: 'var(--ink-soft)', lineHeight: '1.35' }}>
                          <strong>Notes:</strong> {req.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '11.5px', color: 'var(--ink-soft)', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 600, color: 'var(--teal)' }}>{req.clientName}</div>
                      {req.deadline && (
                        <div style={{ fontSize: '11px', color: 'var(--ink-muted)', marginTop: '2px' }}>
                          Due: {fmtDate(req.deadline)}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {getStatusBadge(req.status)}
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
