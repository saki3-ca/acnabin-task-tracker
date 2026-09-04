import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Briefcase,
  Building,
  CheckCircle2,
  Clock,
  Edit3,
  FileText,
  Hash,
  KeyRound,
  Mail,
  Trash2,
  Upload,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { canViewAllClients, getUserAssignedClientIds, isSAMOrAbove } from '../../lib/permissions';
import { adminService } from '../../services/adminService';
import { api } from '../../services/api';
import { Modal } from '../ui/Modal';

/**
 * Compresses an image file in the browser using HTML Canvas down to max 250x250px.
 * Resulting file is ~15-30 KB, ensuring zero lag on Vercel / GitHub deployments.
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_SIZE) {
            height = Math.round((height * MAX_SIZE) / width);
            width = MAX_SIZE;
          }
        } else {
          if (height > MAX_SIZE) {
            width = Math.round((width * MAX_SIZE) / height);
            height = MAX_SIZE;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        // Compress as JPEG at 0.82 quality -> under 25KB!
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.82);
        resolve(compressedBase64);
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export const ProfileView: React.FC = () => {
  const { currentUser, allClients, refreshContextData } = useAuth();
  const { myTasks, teamTasks, myStats } = useTasks();

  const [assignedClientIds, setAssignedClientIds] = useState<string[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);

  // Edit Profile Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string>('');
  const [editCurrentPassword, setEditCurrentPassword] = useState('');
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSeeAll = canViewAllClients(currentUser);

  useEffect(() => {
    if (!currentUser) return;

    if (canSeeAll) {
      setAssignedClientIds(allClients.map(c => c.id));
      return;
    }

    setIsLoadingClients(true);
    adminService
      .getManagerClientIds(currentUser.id)
      .then(ids => {
        const clientSet = new Set<string>(ids || []);
        if (currentUser.assignedClientIds && Array.isArray(currentUser.assignedClientIds)) {
          currentUser.assignedClientIds.forEach(cid => clientSet.add(cid));
        }
        if (currentUser.signupClientId) {
          currentUser.signupClientId
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .forEach(cid => clientSet.add(cid));
        }
        setAssignedClientIds(Array.from(clientSet));
      })
      .catch(() => {
        const fallback = getUserAssignedClientIds(currentUser);
        setAssignedClientIds(fallback);
      })
      .finally(() => setIsLoadingClients(false));
  }, [currentUser, canSeeAll, allClients]);

  const assignedClientsList = useMemo(() => {
    if (canSeeAll) return allClients;
    return allClients.filter(c => assignedClientIds.includes(c.id));
  }, [allClients, assignedClientIds, canSeeAll]);

  if (!currentUser) return null;

  // Task distribution across assigned clients:
  // For AD and above (canSeeAll = true), aggregate all users' tasks from teamTasks.
  // For other users, count their own assigned tasks.
  const clientTaskCounts = useMemo(() => {
    const counts: Record<string, { total: number; active: number }> = {};
    const taskList = canSeeAll ? teamTasks : myTasks;

    taskList.forEach(t => {
      if (t.clientId) {
        if (!counts[t.clientId]) {
          counts[t.clientId] = { total: 0, active: 0 };
        }
        counts[t.clientId].total += 1;
        if (t.status !== 'Completed') {
          counts[t.clientId].active += 1;
        }
      }
    });
    return counts;
  }, [myTasks, teamTasks, canSeeAll]);

  const initials = currentUser.name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const openEditModal = () => {
    setEditName(currentUser.name);
    setEditEmail(currentUser.email);
    setEditAvatarUrl(currentUser.avatarUrl || '');
    setEditCurrentPassword('');
    setEditNewPassword('');
    setEditConfirmPassword('');
    setModalFeedback(null);
    setIsEditModalOpen(true);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file (PNG, JPG, JPEG, WEBP).');
      return;
    }

    try {
      // Compress in-browser
      const compressedDataUrl = await compressImage(file);
      setEditAvatarUrl(compressedDataUrl);
    } catch (err) {
      console.error('Error compressing image', err);
      alert('Failed to process the image. Please choose another image.');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalFeedback(null);

    if (!editName.trim()) {
      setModalFeedback({ type: 'error', text: 'Name cannot be empty.' });
      return;
    }

    if (!editEmail.trim() || !editEmail.includes('@')) {
      setModalFeedback({ type: 'error', text: 'Please provide a valid email address.' });
      return;
    }

    // Password change validation if password fields are provided
    if (editNewPassword || editCurrentPassword || editConfirmPassword) {
      if (!editCurrentPassword) {
        setModalFeedback({ type: 'error', text: 'Please enter your current password to set a new password.' });
        return;
      }
      if (editNewPassword.length < 4) {
        setModalFeedback({ type: 'error', text: 'New password must be at least 4 characters.' });
        return;
      }
      if (editNewPassword !== editConfirmPassword) {
        setModalFeedback({ type: 'error', text: 'New password and confirmation do not match.' });
        return;
      }
    }

    setIsSaving(true);
    try {
      // 1. Update basic profile and photo
      await adminService.updateUser(currentUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        avatarUrl: editAvatarUrl
      });

      // 2. Update password if requested
      if (editNewPassword) {
        await api.callBackend('changePassword', {
          userId: currentUser.id,
          currentPassword: editCurrentPassword,
          newPassword: editNewPassword
        });
      }

      await refreshContextData();
      setModalFeedback({ type: 'success', text: 'Profile updated successfully!' });

      setTimeout(() => {
        setIsEditModalOpen(false);
      }, 700);
    } catch (err: any) {
      console.error(err);
      setModalFeedback({ type: 'error', text: err?.message || 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-page" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. Header Profile Banner & Summary Card */}
      <div className="table-card">
        <div
          className="banner-strip banner-maroon"
          style={{ justifyContent: 'space-between', padding: '0 20px' }}
        >
          <span style={{ fontSize: '13.5px', fontWeight: 700, letterSpacing: '0.8px' }}>
            OFFICIAL EMPLOYEE PROFILE
          </span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 600,
              opacity: 0.9,
              letterSpacing: '0.6px',
              background: 'rgba(255, 255, 255, 0.15)',
              padding: '3px 10px',
              borderRadius: '4px'
            }}
          >
            ACNABIN CHARTERED ACCOUNTANTS
          </span>
        </div>

        <div style={{ padding: '24px', background: '#FFFFFF' }}>
          {/* Identity Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              borderBottom: '1px solid var(--line-soft)',
              paddingBottom: '20px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
              {/* Avatar Circle */}
              <div
                style={{
                  position: 'relative',
                  width: '74px',
                  height: '74px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--navy) 0%, #3B82F6 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '24px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  boxShadow: '0 4px 12px rgba(27, 54, 93, 0.2)',
                  overflow: 'hidden',
                  border: '2px solid #FFFFFF'
                }}
              >
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>

              {/* Identity Info */}
              <div style={{ minWidth: '220px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
                    {currentUser.name}
                  </h2>
                  <span className={`role-badge ${currentUser.role.toLowerCase()}`} style={{ fontSize: '11px' }}>
                    {currentUser.designation}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: currentUser.status === 'ACTIVE' ? '#DEF7EC' : '#FDE8E8',
                      color: currentUser.status === 'ACTIVE' ? '#03543F' : '#9B1C1C'
                    }}
                  >
                    {currentUser.status}
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '20px',
                    marginTop: '8px',
                    flexWrap: 'wrap',
                    fontSize: '12.5px',
                    color: 'var(--ink-soft)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Mail size={14} color="var(--navy)" /> {currentUser.email}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Hash size={14} color="var(--navy)" />
                    {currentUser.designation === 'Partner'
                      ? `Initial: ${currentUser.empId || 'N/A'}`
                      : currentUser.role === 'ADMIN'
                      ? `Admin ID: ${currentUser.empId || 'N/A'}`
                      : currentUser.empId || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Profile Action Button (Right side, matching attachment) */}
            <div>
              <button
                type="button"
                onClick={openEditModal}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 18px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1.5px solid var(--line-strong)',
                  background: '#ffffff',
                  color: 'var(--ink)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  cursor: 'pointer'
                }}
              >
                <Edit3 size={14} /> Edit Profile
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '16px',
              marginTop: '20px'
            }}
          >
            <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid var(--line-soft)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
                Assigned Clients
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--navy)', marginTop: '4px' }}>
                {canSeeAll ? 'All' : assignedClientsList.length}
              </div>
            </div>

            <div style={{ background: '#F8FAFC', padding: '14px', borderRadius: '8px', border: '1px solid var(--line-soft)', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase' }}>
                Total Tasks
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ink)', marginTop: '4px' }}>
                {myStats.total}
              </div>
            </div>

            <div style={{ background: '#F0FDF4', padding: '14px', borderRadius: '8px', border: '1px solid #BBF7D0', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>
                Completed Tasks
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#166534', marginTop: '4px' }}>
                {myStats.completed}
              </div>
            </div>

            <div style={{ background: '#FFFBEB', padding: '14px', borderRadius: '8px', border: '1px solid #FDE68A', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase' }}>
                Pending / In Progress
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#92400E', marginTop: '4px' }}>
                {myStats.pending + myStats.inProgress}
              </div>
            </div>

            <div style={{ background: '#FEF2F2', padding: '14px', borderRadius: '8px', border: '1px solid #FECACA', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase' }}>
                Overdue Tasks
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#991B1B', marginTop: '4px' }}>
                {myStats.overdue}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Primary Section: Assigned Clients */}
      <div className="table-card">
        <div className="banner-strip banner-teal">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <Briefcase size={16} />
            <span>YOUR ASSIGNED CLIENT ENGAGEMENTS</span>
          </div>
          <span
            style={{
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '11.5px',
              background: 'rgba(255,255,255,0.2)',
              padding: '2px 8px',
              borderRadius: '10px'
            }}
          >
            {canSeeAll ? 'FIRM-WIDE OVERSIGHT' : `${assignedClientsList.length} CLIENTS ASSIGNED`}
          </span>
        </div>

        <div className="table-responsive">
          <table className="data-table teal-table">
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>SL.</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Client Code</th>
                <th style={{ textAlign: 'left', minWidth: '220px' }}>Client / Company Name</th>
                <th style={{ width: '150px', textAlign: 'center' }}>Job Number</th>
                <th style={{ width: '130px', textAlign: 'center' }}>ACTIVE TASKS</th>
                <th style={{ width: '120px', textAlign: 'center' }}>Engagement Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingClients ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px' }}>
                    <div className="loading-indicator">Loading your assigned clients…</div>
                  </td>
                </tr>
              ) : assignedClientsList.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty-state" style={{ padding: '32px 16px', textAlign: 'center' }}>
                    <Building size={32} style={{ color: 'var(--ink-muted)', marginBottom: '8px', opacity: 0.5 }} />
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>
                      No clients assigned to your profile yet
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: '4px' }}>
                      Please contact an Administrator or Engagement Partner to have client engagements assigned to you.
                    </div>
                  </td>
                </tr>
              ) : (
                assignedClientsList.map((client, idx) => {
                  const stats = clientTaskCounts[client.id] || { total: 0, active: 0 };
                  const activeCount = stats.active;
                  const totalCount = stats.total;
                  const badgeCount = canSeeAll ? activeCount : totalCount;

                  return (
                    <tr key={client.id}>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--ink-muted)' }}>
                        {idx + 1}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: 'var(--navy)' }}>
                        {client.id}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--ink)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Building size={15} color="var(--ink-soft)" />
                          <span>{client.name}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '12px', color: 'var(--ink-soft)' }}>
                        {client.jobNumber || '—'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: badgeCount > 0 ? '#EBF4FF' : '#F1F5F9',
                            color: badgeCount > 0 ? '#1E40AF' : '#64748B'
                          }}
                        >
                          <FileText size={11} /> {badgeCount} {badgeCount === 1 ? 'task' : 'tasks'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700,
                            background: client.status === 'ACTIVE' ? '#DEF7EC' : '#F3F4F6',
                            color: client.status === 'ACTIVE' ? '#03543F' : '#6B7280'
                          }}
                        >
                          <CheckCircle2 size={11} /> {client.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Profile"
        maxWidth="560px"
      >
        <form onSubmit={handleSaveProfile}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {modalFeedback && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  background: modalFeedback.type === 'success' ? '#DEF7EC' : '#FDE8E8',
                  color: modalFeedback.type === 'success' ? '#03543F' : '#9B1C1C',
                  border: `1px solid ${modalFeedback.type === 'success' ? '#31C48D' : '#F98080'}`
                }}
              >
                {modalFeedback.text}
              </div>
            )}

            {/* Profile Photo Upload Section */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '12px 16px',
                background: '#F8FAFC',
                borderRadius: '8px',
                border: '1px solid var(--line-soft)'
              }}
            >
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'var(--navy)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: 700,
                  overflow: 'hidden',
                  flexShrink: 0
                }}
              >
                {editAvatarUrl ? (
                  <img
                    src={editAvatarUrl}
                    alt="Preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span>{initials}</span>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>
                  Profile Photograph
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', padding: '4px 10px' }}
                  >
                    <Upload size={13} /> Upload Photo
                  </button>

                  {editAvatarUrl && (
                    <button
                      type="button"
                      onClick={() => setEditAvatarUrl('')}
                      className="btn btn-danger btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11.5px', padding: '4px 8px' }}
                      title="Remove photo"
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="form-field">
              <label>Full Name</label>
              <input
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="form-input"
                placeholder="Enter full name..."
                required
              />
            </div>

            <div className="form-field">
              <label>Email Address</label>
              <input
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                className="form-input"
                placeholder="Enter official email..."
                required
              />
            </div>

            {/* Read-Only Hierarchy Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="form-field">
                <label>
                  {currentUser.designation === 'Partner'
                    ? '# Initial'
                    : currentUser.role === 'ADMIN'
                    ? 'Admin ID'
                    : isSAMOrAbove(currentUser.designation)
                    ? 'EMP ID'
                    : 'STD ID'}
                </label>
                <input
                  type="text"
                  value={currentUser.empId || 'N/A'}
                  disabled
                  className="form-input"
                  style={{ background: '#F1F5F9', color: '#64748B', cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-field">
                <label>Designation</label>
                <input
                  type="text"
                  value={currentUser.designation}
                  disabled
                  className="form-input"
                  style={{ background: '#F1F5F9', color: '#64748B', cursor: 'not-allowed' }}
                />
              </div>
            </div>

            {/* Change Password / Credentials (Optional) */}
            <div
              style={{
                marginTop: '6px',
                padding: '12px 14px',
                borderRadius: '8px',
                background: '#FFFDF9',
                border: '1px solid #FED7AA'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '12.5px', color: '#9A3412', marginBottom: '8px' }}>
                <KeyRound size={14} />
                Change Password (Optional)
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)', marginBottom: '10px' }}>
                Leave password fields blank if you do not want to change your password.
              </div>

              <div className="form-field" style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11.5px' }}>Current Password</label>
                <input
                  type="password"
                  value={editCurrentPassword}
                  onChange={e => setEditCurrentPassword(e.target.value)}
                  placeholder="Enter current password..."
                  className="form-input"
                  style={{ fontSize: '12px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div className="form-field">
                  <label style={{ fontSize: '11.5px' }}>New Password</label>
                  <input
                    type="password"
                    value={editNewPassword}
                    onChange={e => setEditNewPassword(e.target.value)}
                    placeholder="New password..."
                    className="form-input"
                    style={{ fontSize: '12px' }}
                  />
                </div>

                <div className="form-field">
                  <label style={{ fontSize: '11.5px' }}>Confirm Password</label>
                  <input
                    type="password"
                    value={editConfirmPassword}
                    onChange={e => setEditConfirmPassword(e.target.value)}
                    placeholder="Confirm new password..."
                    className="form-input"
                    style={{ fontSize: '12px' }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              {isSaving ? 'Saving Changes…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
