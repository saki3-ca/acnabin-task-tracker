import { formatPeriod } from '../../lib/staffSheet';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import {
  Briefcase,
  Building,
  CheckCircle2,
  Edit3,
  FileText,
  Hash,
  KeyRound,
  Mail,
  Phone,
  Plus,
  Trash2,
  Upload
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { MyInfo } from '../../types';
import { canViewAllClients, DESIGNATION_RANKS, getUserAssignedClientIds, getUserRank, isSAMOrAbove, isStudentLevelDesignation, normalizeBDMobile } from '../../lib/permissions';
import { adminService } from '../../services/adminService';
import { notificationService } from '../../services/notificationService';
import { api } from '../../services/api';
import { clientService } from '../../services/clientService';
import { useNotifications } from '../../context/NotificationContext';
import { ClientLabel } from '../ui/ClientLabel';
import { StaffDetailsCard } from './StaffDetailsCard';
import { academicYearFromStart, employmentYearFromJoining, isEmployeeProfile, PRINCIPALS, canonicalPrincipal } from '../../lib/academicYear';
import { titleCaseWords } from '../../lib/text';
import { staffService } from '../../services/staffService';
import { MyStaff } from '../../types';
import { Modal } from '../ui/Modal';
import { CompletedTasksModal } from '../tasks/CompletedTasksModal';

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

interface ProfileViewProps {
  onNavigateToTasks?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({ onNavigateToTasks }) => {
  const { currentUser, allClients, refreshContextData } = useAuth();
  const { myTasks, teamTasks, myStats } = useTasks();

  const canSeeAll = canViewAllClients(currentUser);
  // Client list management: AD and above (and Admin) can add clients; only Admin can delete.
  const canAddClients = canSeeAll;
  const canDeleteClients = currentUser?.role === 'ADMIN';
  const canEditClients = currentUser?.role === 'ADMIN';

  const [isAddClientOpen, setIsAddClientOpen] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientJobNumber, setNewClientJobNumber] = useState('');
  const [newClientStatus, setNewClientStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  // Set when the client modal is editing an existing client (Admin) instead of adding one.
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [addClientError, setAddClientError] = useState<string | null>(null);
  const [clientNotice, setClientNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

  const [assignedClientIds, setAssignedClientIds] = useState<string[]>(() => {
    if (!currentUser) return [];
    if (canViewAllClients(currentUser)) return allClients.map(c => c.id);
    const cached = adminService.getCachedManagerClientIds(currentUser.id);
    const fallback = getUserAssignedClientIds(currentUser);
    const clientSet = new Set<string>([...(cached || []), ...fallback]);
    return Array.from(clientSet);
  });
  const [isLoadingClients, setIsLoadingClients] = useState<boolean>(() => {
    if (!currentUser) return false;
    if (canViewAllClients(currentUser)) return false;
    const cached = adminService.getCachedManagerClientIds(currentUser.id);
    const fallback = getUserAssignedClientIds(currentUser);
    return !cached && fallback.length === 0;
  });

  // Edit Profile Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editAvatarUrl, setEditAvatarUrl] = useState<string>('');
  const [editAcademicYear, setEditAcademicYear] = useState('');
  const [editSalary, setEditSalary] = useState('');
  const [editDaily, setEditDaily] = useState('');
  const [editBlood, setEditBlood] = useState('');
  const [editEmName, setEditEmName] = useState('');
  const [editEmPhone, setEditEmPhone] = useState('');
  const [detailsKey, setDetailsKey] = useState(0);
  const [staffSnap, setStaffSnap] = useState<MyStaff | null>(null);
  const [editDept, setEditDept] = useState('');
  const [editJoining, setEditJoining] = useState('');
  const [editArtStart, setEditArtStart] = useState('');
  const [editArtEnd, setEditArtEnd] = useState('');
  const [editPrincipal, setEditPrincipal] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editEmRel, setEditEmRel] = useState('');
  const [editLaptopAvail, setEditLaptopAvail] = useState('');
  const [editLaptopOwner, setEditLaptopOwner] = useState('');
  const [editLaptopId, setEditLaptopId] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [infoSnap, setInfoSnap] = useState<MyInfo | null>(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [editClients, setEditClients] = useState<{ id: string; name: string }[]>([]);
  const [clientsSnap, setClientsSnap] = useState('');
  const [editClientInput, setEditClientInput] = useState('');
  const [editClientSuggestions, setEditClientSuggestions] = useState<{ id: string; name: string }[]>([]);
  const [editNewPassword, setEditNewPassword] = useState('');
  const [editConfirmPassword, setEditConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!currentUser) return;

    if (canSeeAll) {
      setAssignedClientIds(allClients.map(c => c.id));
      setIsLoadingClients(false);
      return;
    }

    const cached = adminService.getCachedManagerClientIds(currentUser.id);
    const fallback = getUserAssignedClientIds(currentUser);
    if (!cached && fallback.length === 0) {
      setIsLoadingClients(true);
    }

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
        const currentFallback = getUserAssignedClientIds(currentUser);
        setAssignedClientIds(currentFallback);
      })
      .finally(() => setIsLoadingClients(false));
  }, [currentUser, canSeeAll, allClients]);

  const assignedClientsList = useMemo(() => {
    if (canSeeAll) return allClients;
    return allClients.filter(c => assignedClientIds.includes(c.id));
  }, [allClients, assignedClientIds, canSeeAll]);

  const completedTasks = useMemo(() => {
    return myTasks.filter(t => t.status === 'Completed');
  }, [myTasks]);

  // Task distribution across assigned clients:
  // Everyone above Student sees the client's total tasks (all team members).
  // Students (and trainees) see only their own tasks.
  const isStudentLevel = isStudentLevelDesignation(currentUser?.designation);
  const clientTaskCounts = useMemo(() => {
    const counts: Record<string, { total: number; active: number }> = {};
    const taskList = isStudentLevel ? myTasks : teamTasks;

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
  }, [myTasks, teamTasks, isStudentLevel]);

  const { notifications, markAsRead } = useNotifications();

  if (!currentUser) return null;

  // Partners keep a short profile: no allowance, emergency contact, clients or employment details
  const isPartner = currentUser.designation === 'Partner';

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
    setEditMobile(currentUser.mobile || '');
    setEditAvatarUrl(currentUser.avatarUrl || '');
    setEditNewPassword('');
    setEditConfirmPassword('');
    setModalFeedback(null);

    // Assigned clients (same source as signup / Manpower edit)
    const current = getUserAssignedClientIds(currentUser)
      .map(id => allClients.find(c => c.id === id))
      .filter((c): c is NonNullable<typeof c> => Boolean(c))
      .map(c => ({ id: c.id, name: c.name }));
    setEditClients(current);
    setClientsSnap(current.map(c => c.id).sort().join(','));
    setEditClientInput('');
    setEditClientSuggestions([]);

    // Personal / work information: load what is saved so the form shows it
    setEditAcademicYear('');
    setEditSalary('');
    setEditDaily('');
    setEditBlood('');
    setEditEmName('');
    setEditEmPhone('');
    setInfoSnap(null);
    setStaffSnap(null);
    [setEditDept, setEditJoining, setEditArtStart, setEditArtEnd, setEditPrincipal, setEditAddress, setEditEmRel, setEditLaptopAvail, setEditLaptopOwner, setEditLaptopId, setEditRemarks].forEach(f => f(''));
    staffService
      .getMyStaff()
      .then(st => {
        setStaffSnap(st);
        if (!st) return;
        setEditDept(st.department || '');
        setEditJoining(st.joiningDate || '');
        setEditArtStart(st.articleshipStart || '');
        setEditArtEnd(st.articleshipEnd || '');
        setEditPrincipal(canonicalPrincipal(st.principalName));
        setEditAddress(titleCaseWords(st.presentAddress || ''));
        setEditEmRel(st.emergencyRelationship || '');
        setEditLaptopAvail(st.laptopAvailable || '');
        setEditLaptopOwner(st.laptopOwnership || '');
        setEditLaptopId(st.laptopId || '');
        setEditRemarks(st.remarks || '');
        // Same fallback as the profile page: what the sheet has, unless the person saved their own
        if (!isPartner) {
          setEditBlood(v => v || st.bloodGroup || '');
          setEditEmName(v => v || st.emergencyName || '');
          setEditEmPhone(v => v || st.emergencyPhone || '');
        }
      })
      .catch(() => setStaffSnap(null));
    setInfoLoading(true);
    notificationService
      .getMyInfo()
      .then(info => {
        setInfoSnap(info);
        if (info) {
          setEditAcademicYear(info.academicYear || '');
          setEditSalary(info.salary === null ? '' : String(info.salary));
          setEditDaily(info.dailyConveyance === null ? '' : String(info.dailyConveyance));
          setEditBlood(v => info.bloodGroup || v);
          setEditEmName(v => info.emergencyName || v);
          setEditEmPhone(v => info.emergencyPhone || v);
        }
      })
      .catch(() => setInfoSnap(null))
      .finally(() => setInfoLoading(false));

    setIsEditModalOpen(true);
  };

  const handleEditClientInput = (val: string) => {
    setEditClientInput(val);
    if (val.trim()) {
      setEditClientSuggestions(
        allClients
          .filter(
            c =>
              (c.name.toLowerCase().includes(val.toLowerCase()) || (c.jobNumber || '').toLowerCase().includes(val.toLowerCase())) &&
              !editClients.find(sc => sc.id === c.id)
          )
          .slice(0, 8)
          .map(c => ({ id: c.id, name: c.name }))
      );
    } else {
      setEditClientSuggestions([]);
    }
  };

  const addEditClient = (c: { id: string; name: string }) => {
    setEditClients(prev => (prev.find(x => x.id === c.id) ? prev : [...prev, c]));
    setEditClientInput('');
    setEditClientSuggestions([]);
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
    if (editNewPassword || editConfirmPassword) {
      if (editNewPassword.length < 4) {
        setModalFeedback({ type: 'error', text: 'New password must be at least 4 characters.' });
        return;
      }
      if (editNewPassword !== editConfirmPassword) {
        setModalFeedback({ type: 'error', text: 'New password and confirmation do not match.' });
        return;
      }
    }

    let normalizedMobile = '';
    if (editMobile.trim()) {
      const norm = normalizeBDMobile(editMobile.trim());
      if (!norm) {
        setModalFeedback({
          type: 'error',
          text: 'Please provide a valid Bangladesh mobile number (11 digits starting with 01, e.g. 01XXXXXXXXX).'
        });
        return;
      }
      normalizedMobile = norm;
    }

    // Personal / work information (every field is optional; empty = leave as it is)
    const salaryNum = editSalary.trim() === '' ? '' : Number(editSalary);
    const dailyNum = editDaily.trim() === '' ? '' : Number(editDaily);
    if (salaryNum !== '' && (Number.isNaN(salaryNum) || salaryNum < 0)) {
      setModalFeedback({ type: 'error', text: 'Please enter a valid monthly salary/allowance.' });
      return;
    }
    if (dailyNum !== '' && (Number.isNaN(dailyNum) || dailyNum < 0)) {
      setModalFeedback({ type: 'error', text: 'Please enter a valid daily conveyance.' });
      return;
    }
    let emPhoneNorm = '';
    if (editEmPhone.trim()) {
      const n = normalizeBDMobile(editEmPhone.trim());
      if (!n) {
        setModalFeedback({ type: 'error', text: 'Please enter a valid emergency contact mobile number (01XXXXXXXXX).' });
        return;
      }
      emPhoneNorm = n;
    }
    const snap = infoSnap;
    const infoChanged =
      (hasYearField && editAcademicYear !== (snap?.academicYear || '')) ||
      editSalary.trim() !== (snap?.salary == null ? '' : String(snap.salary)) ||
      editDaily.trim() !== (snap?.dailyConveyance == null ? '' : String(snap.dailyConveyance)) ||
      editBlood !== (snap?.bloodGroup || '') ||
      editEmName.trim() !== (snap?.emergencyName || '') ||
      emPhoneNorm !== (snap?.emergencyPhone || '');
    const clientsChanged = editClients.map(c => c.id).sort().join(',') !== clientsSnap;

    // Official employee profile fields (blank = leave as it is)
    const staffFields: Record<string, string> = {
      department: editDept.trim(),
      joining_date: editJoining,
      present_address: titleCaseWords(editAddress),
      emergency_relationship: editEmRel.trim(),
      laptop_available: editLaptopAvail,
      laptop_ownership: editLaptopOwner.trim(),
      laptop_id: editLaptopId.trim(),
      remarks: editRemarks.trim()
    };
    if (!isEmployeeProfile(currentUser.empId, currentUser.designation)) {
      staffFields.articleship_start = editArtStart;
      staffFields.articleship_end = editArtEnd;
      staffFields.principal_name = editPrincipal;
      if (editArtStart && editArtEnd) {
        staffFields.articleship_period = formatPeriod(editArtStart, editArtEnd);
      }
    }
    const st = staffSnap;
    const staffChanged =
      editDept.trim() !== (st?.department || '') ||
      editJoining !== (st?.joiningDate || '') ||
      staffFields.present_address !== titleCaseWords(st?.presentAddress || '') ||
      editEmRel.trim() !== (st?.emergencyRelationship || '') ||
      editLaptopAvail !== (st?.laptopAvailable || '') ||
      editLaptopOwner.trim() !== (st?.laptopOwnership || '') ||
      editLaptopId.trim() !== (st?.laptopId || '') ||
      editRemarks.trim() !== (st?.remarks || '') ||
      (!isEmployeeProfile(currentUser.empId, currentUser.designation) &&
        (editArtStart !== (st?.articleshipStart || '') ||
          editArtEnd !== (st?.articleshipEnd || '') ||
          editPrincipal !== canonicalPrincipal(st?.principalName)));

    setIsSaving(true);
    try {
      // 1. Update basic profile, photo and (if changed) assigned clients
      await adminService.updateUser(currentUser.id, {
        name: editName.trim(),
        email: editEmail.trim(),
        avatarUrl: editAvatarUrl,
        mobile: normalizedMobile,
        ...(clientsChanged ? { assignedClientIds: editClients.map(c => c.id) } : {})
      });

      // 1b. Personal / work information (after clients, so the Walton 24-day rule sees the new clients)
      if (infoChanged) {
        await notificationService.saveMyInfo({
          academicYear: hasYearField ? editAcademicYear : '',
          salary: salaryNum,
          dailyConveyance: dailyNum,
          bloodGroup: editBlood,
          emergencyName: editEmName.trim(),
          emergencyPhone: emPhoneNorm
        });
        // Filling this in also completes any pending "update info" request
        notifications.filter(n => n.type === 'INFO_REQUEST' && !n.isRead).forEach(n => markAsRead(n.id));
      }

      // 1c. Official employee profile (department, dates, principal, address, laptop ...)
      if (staffChanged) {
        await staffService.saveMyStaff(staffFields);
      }

      // 2. Update password if requested
      if (editNewPassword) {
        await api.callBackend('changePassword', {
          userId: currentUser.id,
          newPassword: editNewPassword
        });
      }

      await refreshContextData();
      setDetailsKey(k => k + 1);
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

  const openAddClient = () => {
    setEditingClientId(null);
    setNewClientName('');
    setNewClientJobNumber('');
    setNewClientStatus('ACTIVE');
    setAddClientError(null);
    setIsAddClientOpen(true);
  };

  const openEditClient = (client: { id: string; name: string; jobNumber?: string; status: 'ACTIVE' | 'INACTIVE' }) => {
    setEditingClientId(client.id);
    setNewClientName(client.name);
    setNewClientJobNumber(client.jobNumber || '');
    setNewClientStatus(client.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE');
    setAddClientError(null);
    setIsAddClientOpen(true);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim()) {
      setAddClientError('Please enter the client name.');
      return;
    }
    setAddClientError(null);
    setIsSavingClient(true);
    try {
      if (editingClientId) {
        const updated = await clientService.updateClient(editingClientId, {
          name: newClientName.trim(),
          // Leaving the Job ID blank keeps the current one.
          jobNumber: newClientJobNumber.trim() || undefined,
          status: newClientStatus
        });
        await refreshContextData();
        setIsAddClientOpen(false);
        setClientNotice({ type: 'success', text: `Client "${updated.name}" updated.` });
      } else {
        const created = await clientService.addClient(newClientName.trim(), newClientJobNumber.trim() || undefined);
        await refreshContextData();
        setIsAddClientOpen(false);
        setClientNotice({ type: 'success', text: `Client "${created.name}" added (Job ID ${created.jobNumber}).` });
      }
    } catch (err: any) {
      setAddClientError(err?.message || (editingClientId ? 'Could not save the client.' : 'Could not add the client.') + ' Please try again.');
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleDeleteClient = async (clientId: string, clientName: string) => {
    const taskCount = clientTaskCounts[clientId]?.total || 0;
    const warning =
      `Delete client "${clientName}"?\n\n` +
      `It will be removed from the client list and from every user and manager it is assigned to.` +
      (taskCount > 0 ? `\n${taskCount} existing task(s) keep the client name for history.` : '') +
      `\n\nThis cannot be undone.`;
    if (!window.confirm(warning)) return;

    setDeletingClientId(clientId);
    setClientNotice(null);
    try {
      await clientService.deleteClient(clientId);
      await refreshContextData();
      setClientNotice({ type: 'success', text: `Client "${clientName}" deleted.` });
    } catch (err: any) {
      setClientNotice({ type: 'error', text: err?.message || 'Could not delete the client. Please try again.' });
    } finally {
      setDeletingClientId(null);
    }
  };

  // Assigned clients sit inside the info box from Senior Assistant Manager up; below that they stay above it
  const payFullLabel = isEmployeeProfile(currentUser.empId, currentUser.designation) ? 'Monthly Salary (৳)' : 'Monthly Allowance (৳)';
  const payShortLabel = isEmployeeProfile(currentUser.empId, currentUser.designation) ? 'Salary (৳)' : 'Allowance (৳)';
  const clientsInInfoBox = getUserRank(currentUser) >= DESIGNATION_RANKS['Senior Assistant Manager'];
  const hasYearField = isStudentLevelDesignation(currentUser.designation) && !editArtStart;
  const infoInputStyle: React.CSSProperties = { height: '38px', padding: '0 10px', margin: 0, fontSize: '12.5px', lineHeight: '36px', boxSizing: 'border-box', width: '100%', minWidth: 0 };
  const conveyanceDays = editClients.some(c => /walton/i.test(c.name)) ? 24 : 22;
  const conveyanceHint =
    `Daily conveyance × ${conveyanceDays} days = ৳ ${((Number(editDaily) || 0) * conveyanceDays).toLocaleString('en-IN')} / month` +
    (infoSnap?.conveyance != null && editDaily.trim() === '' ? ` (saved: ৳ ${infoSnap.conveyance.toLocaleString('en-IN')})` : '');

  // Assigned-client picker (search by name or job ID, like signup)
  const clientPicker = (
            <div className="form-field" style={{ position: 'relative' }}>
              <label style={clientsInInfoBox ? { fontSize: '11.5px' } : undefined}>Assigned Client(s)</label>
              {editClients.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '6px' }}>
                  {editClients.map(c => (
                    <span
                      key={c.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'var(--navy-light, #EBF0FE)',
                        border: '1px solid var(--navy, #1B2A6B)',
                        borderRadius: '20px',
                        padding: '2px 10px',
                        fontSize: '12px',
                        color: 'var(--navy, #1B2A6B)',
                        fontWeight: 600
                      }}
                    >
                      <span><ClientLabel id={c.id} name={c.name} /></span>
                      <button
                        type="button"
                        onClick={() => setEditClients(prev => prev.filter(x => x.id !== c.id))}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--maroon)', fontWeight: 700, padding: 0, lineHeight: 1, fontSize: '14px' }}
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
              <input
                type="text"
                className="form-input"
                value={editClientInput}
                onChange={e => handleEditClientInput(e.target.value)}
                onBlur={() => setTimeout(() => setEditClientSuggestions([]), 150)}
                placeholder="Type to search client name or job ID…"
                autoComplete="off"
                style={clientsInInfoBox ? infoInputStyle : undefined}
              />
              {editClientSuggestions.length > 0 && (
                <ul
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 100,
                    background: '#fff',
                    border: '1px solid var(--line)',
                    borderRadius: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
                    margin: 0,
                    padding: '4px 0',
                    listStyle: 'none',
                    maxHeight: '160px',
                    overflowY: 'auto'
                  }}
                >
                  {editClientSuggestions.map(c => (
                    <li
                      key={c.id}
                      onMouseDown={() => addEditClient(c)}
                      style={{ padding: '8px 14px', cursor: 'pointer', fontSize: '13px', color: 'var(--ink)' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-alt, #F5F3EF)')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <ClientLabel id={c.id} name={c.name} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
  );

  return (
    <div className="profile-page" style={{ display: 'contents' }}>
      {/* 1. Header Profile Banner & Summary Card */}
      <div className="table-card">
        <div
          className="banner-strip banner-maroon"
          style={{ justifyContent: 'center', padding: '0 20px' }}
        >
          <span style={{ fontSize: '13.5px', fontWeight: 700, letterSpacing: '0.8px' }}>
            {isPartner ? "OFFICIAL PARTNER'S PROFILE" : isEmployeeProfile(currentUser.empId, currentUser.designation) ? 'OFFICIAL EMPLOYEE PROFILE' : 'OFFICIAL STUDENT PROFILE'}
          </span>
          <span
            style={{
              position: 'absolute',
              right: '20px',
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

        <div style={{ padding: '20px', background: '#FFFFFF' }}>
          {/* Identity Bar */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              borderBottom: '1px solid var(--line-soft)',
              paddingBottom: '14px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
              {/* Avatar Circle */}
              <div
                style={{
                  position: 'relative',
                  width: '68px',
                  height: '68px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--navy) 0%, #3B82F6 100%)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '22px',
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
                  <h2 style={{ margin: 0, fontSize: '19px', fontWeight: 700, color: 'var(--ink)' }}>
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
                    flexDirection: 'column',
                    gap: '4px',
                    marginTop: '6px',
                    fontSize: '12px',
                    color: 'var(--ink-soft)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={13} color="var(--navy)" /> {currentUser.email}
                  </div>
                  {currentUser.mobile && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={13} color="var(--navy)" /> {currentUser.mobile}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Hash size={13} color="var(--navy)" />
                    {currentUser.designation === 'Partner'
                      ? `Initial: ${currentUser.empId || 'N/A'}`
                      : currentUser.role === 'ADMIN'
                      ? `Admin ID: ${currentUser.empId || 'N/A'}`
                      : currentUser.empId || 'N/A'}
                  </div>
                </div>
              </div>
            </div>

            {/* Edit Profile Action Button */}
            <div>
              <button
                type="button"
                onClick={openEditModal}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1.5px solid var(--line-strong)',
                  background: '#ffffff',
                  color: 'var(--ink)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                  cursor: 'pointer'
                }}
              >
                <Edit3 size={13} /> Edit Profile
              </button>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
              gap: '12px',
              marginTop: '14px'
            }}
          >
            <div
              onClick={() => {
                const el = document.getElementById('profile-assigned-clients-section');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              style={{
                background: '#EFF6FF',
                padding: '8px 12px',
                height: '74px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid #BFDBFE',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
              title="View assigned client engagements below"
            >
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#1E40AF', textTransform: 'uppercase', letterSpacing: '0.6px', lineHeight: 1.2 }}>
                Assigned Clients
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#1E40AF', marginTop: '3px', lineHeight: 1.1 }}>
                {canSeeAll ? 'All' : assignedClientsList.length}
              </div>
            </div>

            <div
              onClick={() => onNavigateToTasks?.()}
              style={{
                background: '#FAF5FF',
                padding: '8px 12px',
                height: '74px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid #E9D5FF',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
              title="Navigate to My Tasks panel"
            >
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#6B21A8', textTransform: 'uppercase', letterSpacing: '0.6px', lineHeight: 1.2 }}>
                Total Active Tasks
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#6B21A8', marginTop: '3px', lineHeight: 1.1 }}>
                {myStats.total}
              </div>
            </div>

            <div
              onClick={() => setIsCompletedModalOpen(true)}
              style={{
                background: '#F0FDF4',
                padding: '8px 12px',
                height: '74px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid #86EFAC',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
              title="Click to open completed tasks window"
            >
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.6px', lineHeight: 1.2 }}>
                Completed Tasks
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#166534', marginTop: '3px', lineHeight: 1.1 }}>
                {myStats.completed}
              </div>
            </div>

            <div
              onClick={() => onNavigateToTasks?.()}
              style={{
                background: '#FFFBEB',
                padding: '8px 12px',
                height: '74px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid #FDE68A',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
              title="Navigate to My Tasks panel"
            >
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#92400E', textTransform: 'uppercase', letterSpacing: '0.6px', lineHeight: 1.2 }}>
                Pending / In Progress
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#92400E', marginTop: '3px', lineHeight: 1.1 }}>
                {myStats.pending + myStats.inProgress}
              </div>
            </div>

            <div
              onClick={() => onNavigateToTasks?.()}
              style={{
                background: '#FEF2F2',
                padding: '8px 12px',
                height: '74px',
                boxSizing: 'border-box',
                borderRadius: '8px',
                border: '1px solid #FECACA',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease'
              }}
              title="Navigate to My Tasks panel"
            >
              <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#991B1B', textTransform: 'uppercase', letterSpacing: '0.6px', lineHeight: 1.2 }}>
                Overdue Tasks
              </div>
              <div style={{ fontSize: '24px', fontWeight: 800, color: '#991B1B', marginTop: '3px', lineHeight: 1.1 }}>
                {myStats.overdue}
              </div>
            </div>
          </div>
        </div>

        {/* Full details (employment, contact, emergency contact, pay, laptop) in the same card */}
        <StaffDetailsCard refreshKey={detailsKey} />
      </div>

      {/* 2. Primary Section: Assigned Clients */}
      <div id="profile-assigned-clients-section" className="table-card">
        <div className="banner-strip banner-teal">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
            <Briefcase size={16} />
            <span>YOUR ASSIGNED CLIENT ENGAGEMENTS</span>
          </div>
          {canAddClients ? (
            <button
              type="button"
              onClick={openAddClient}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11.5px',
                fontWeight: 700,
                color: '#0F5E57',
                background: '#FFFFFF',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '12px',
                cursor: 'pointer'
              }}
            >
              <Plus size={13} /> Add Client
            </button>
          ) : (
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
              {`${assignedClientsList.length} CLIENTS ASSIGNED`}
            </span>
          )}
        </div>

        {clientNotice && (
          <div
            style={{
              margin: '10px 14px 0',
              padding: '8px 12px',
              borderRadius: '6px',
              fontSize: '12.5px',
              fontWeight: 600,
              background: clientNotice.type === 'success' ? '#DEF7EC' : '#FDE8E8',
              color: clientNotice.type === 'success' ? '#03543F' : '#9B1C1C',
              border: `1px solid ${clientNotice.type === 'success' ? '#31C48D' : '#F98080'}`
            }}
          >
            {clientNotice.text}
          </div>
        )}

        <div className="table-responsive">
          <table className="data-table teal-table">
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>SL.</th>
                <th style={{ width: '140px', textAlign: 'center' }}>Job ID</th>
                <th style={{ textAlign: 'left', minWidth: '240px' }}>Client / Company Name</th>
                <th style={{ width: '130px', textAlign: 'center' }}>ACTIVE TASKS</th>
                <th style={{ width: '130px', textAlign: 'center' }}>Engagement Status</th>
                {(canEditClients || canDeleteClients) && <th style={{ width: '170px', textAlign: 'center' }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {isLoadingClients ? (
                <tr>
                  <td colSpan={canEditClients || canDeleteClients ? 6 : 5} style={{ textAlign: 'center', padding: '24px' }}>
                    <div className="loading-indicator">Loading your assigned clients…</div>
                  </td>
                </tr>
              ) : assignedClientsList.length === 0 ? (
                <tr>
                  <td colSpan={canEditClients || canDeleteClients ? 6 : 5} className="empty-state" style={{ padding: '32px 16px', textAlign: 'center' }}>
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
                  const badgeCount = activeCount; // active (pending + in progress) only

                  return (
                    <tr key={client.id}>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--ink-muted)' }}>
                        {idx + 1}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'monospace', fontWeight: 700, color: 'var(--navy)' }}>
                        {client.jobNumber || '—'}
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--ink)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Building size={15} color="var(--ink-soft)" />
                          <span>{client.name}</span>
                        </div>
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
                      {(canEditClients || canDeleteClients) && (
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {canEditClients && (
                            <button
                              type="button"
                              onClick={() => openEditClient(client)}
                              className="btn btn-secondary btn-sm"
                              title={`Edit ${client.name}`}
                              aria-label={`Edit ${client.name}`}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: canDeleteClients ? '6px' : 0 }}
                            >
                              <Edit3 size={13} /> Edit
                            </button>
                          )}
                          {canDeleteClients && (
                          <button
                            type="button"
                            onClick={() => handleDeleteClient(client.id, client.name)}
                            disabled={deletingClientId === client.id}
                            className="btn btn-secondary btn-sm"
                            title={`Delete ${client.name}`}
                            aria-label={`Delete ${client.name}`}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#B91C1C' }}
                          >
                            <Trash2 size={13} /> {deletingClientId === client.id ? '…' : 'Delete'}
                          </button>
                          )}
                        </td>
                      )}
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

            <div className="form-field">
              <label>Mobile Number (Bangladesh)</label>
              <input
                type="tel"
                value={editMobile}
                onChange={e => setEditMobile(e.target.value)}
                className="form-input"
                placeholder="e.g. 01XXXXXXXXX"
              />
            </div>

            {/* Below Senior Assistant Manager: the client field stays on its own, above the info box */}
            {!clientsInInfoBox && !isPartner && clientPicker}

            {/* Personal & work information (all optional) */}
            {!isPartner && (
            <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--navy)', marginBottom: '4px' }}>
                Personal &amp; Work Information
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)', marginBottom: '10px' }}>
                {infoLoading ? 'Loading your saved information…' : 'Optional. Leave a field empty to keep it as it is.'}
              </div>

              {/* 6-column grid so every row is evenly filled and every field is the same size */}
              <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px 10px', alignItems: 'start' }}>
                {hasYearField ? (
                  <>
                    <div className="form-field" style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '11.5px' }}>Academic Year</label>
                      <select className="form-select" value={editAcademicYear} onChange={e => setEditAcademicYear(e.target.value)} style={infoInputStyle}>
                        <option value="">Select…</option>
                        {['1st Year', '2nd Year', '3rd Year', '4th Year'].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field" style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '11.5px' }}>Blood Group</label>
                      <select className="form-select" value={editBlood} onChange={e => setEditBlood(e.target.value)} style={infoInputStyle}>
                        <option value="">Select…</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field" style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '11.5px' }}>{payFullLabel}</label>
                      <input type="number" min="0" className="form-input" value={editSalary} onChange={e => setEditSalary(e.target.value)} placeholder="e.g. 15000" style={infoInputStyle} />
                    </div>
                    <div className="form-field" style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '11.5px' }}>Daily Conveyance (৳ per day)</label>
                      <input type="number" min="0" className="form-input" value={editDaily} onChange={e => setEditDaily(e.target.value)} placeholder="e.g. 120" style={infoInputStyle} />
                    </div>
                  </>
                ) : clientsInInfoBox ? (
                  <>
                    <div style={{ gridColumn: 'span 3' }}>{clientPicker}</div>
                    <div className="form-field" style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '11.5px' }}>Blood Group</label>
                      <select className="form-select" value={editBlood} onChange={e => setEditBlood(e.target.value)} style={infoInputStyle}>
                        <option value="">Select…</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field" style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '11.5px' }}>{payFullLabel}</label>
                      <input type="number" min="0" className="form-input" value={editSalary} onChange={e => setEditSalary(e.target.value)} placeholder="e.g. 15000" style={infoInputStyle} />
                    </div>
                    <div className="form-field" style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '11.5px' }}>Daily Conveyance (৳ per day)</label>
                      <input type="number" min="0" className="form-input" value={editDaily} onChange={e => setEditDaily(e.target.value)} placeholder="e.g. 120" style={infoInputStyle} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-field" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '11.5px' }}>Blood Group</label>
                      <select className="form-select" value={editBlood} onChange={e => setEditBlood(e.target.value)} style={infoInputStyle}>
                        <option value="">Select…</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>{payShortLabel}</label>
                      <input type="number" min="0" className="form-input" value={editSalary} onChange={e => setEditSalary(e.target.value)} placeholder="e.g. 15000" style={infoInputStyle} />
                    </div>
                    <div className="form-field" style={{ gridColumn: 'span 2' }}>
                      <label style={{ fontSize: '11.5px', whiteSpace: 'nowrap' }}>Conveyance (৳/day)</label>
                      <input type="number" min="0" className="form-input" value={editDaily} onChange={e => setEditDaily(e.target.value)} placeholder="e.g. 120" style={infoInputStyle} />
                    </div>
                  </>
                )}


                <div className="form-field" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11.5px' }}>Emergency Name</label>
                  <input type="text" className="form-input" value={editEmName} onChange={e => setEditEmName(e.target.value)} style={infoInputStyle} />
                </div>
                <div className="form-field" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11.5px' }}>Relationship</label>
                  <input type="text" className="form-input" value={editEmRel} onChange={e => setEditEmRel(e.target.value)} placeholder="e.g. Father" style={infoInputStyle} />
                </div>
                <div className="form-field" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11.5px' }}>Emergency Mobile</label>
                  <input type="tel" className="form-input" value={editEmPhone} onChange={e => setEditEmPhone(e.target.value)} placeholder="01XXXXXXXXX" style={infoInputStyle} />
                </div>
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '11.5px' }}>Present Address</label>
                  <input type="text" className="form-input" value={editAddress} onChange={e => setEditAddress(e.target.value)} onBlur={() => setEditAddress(a => titleCaseWords(a))} style={infoInputStyle} />
                </div>
                <div style={{ gridColumn: '1 / -1', fontSize: '11px', color: 'var(--ink-muted)' }}>
                  {conveyanceHint}
                </div>
              </div>
            </div>
            )}

            {/* Official employee profile (full details); Partners have none */}
            {!isPartner && (
            <div style={{ padding: '12px 14px', borderRadius: '8px', background: '#F8FAFC', border: '1px solid var(--line)' }}>
              <div style={{ fontWeight: 700, fontSize: '12.5px', color: 'var(--navy)', marginBottom: '4px' }}>
                Official Employee Profile
              </div>
              <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)', marginBottom: '10px' }}>
                Optional. Leave a field empty to keep it as it is.
              </div>
              <div className="info-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px 10px', alignItems: 'start' }}>
                {!isPartner && (
                  <>
                <div className="form-field" style={{ gridColumn: 'span 3' }}>
                  <label style={{ fontSize: '11.5px' }}>Department</label>
                  <input type="text" className="form-input" value={editDept} onChange={e => setEditDept(e.target.value)} style={infoInputStyle} />
                </div>
                <div className="form-field" style={{ gridColumn: 'span 3' }}>
                  <label style={{ fontSize: '11.5px' }}>Joining Date</label>
                  <input type="date" className="form-input" value={editJoining} onChange={e => setEditJoining(e.target.value)} style={infoInputStyle} />
                </div>
                {isEmployeeProfile(currentUser.empId, currentUser.designation) ? (
                  <div className="form-field" style={{ gridColumn: 'span 3' }}>
                    <label style={{ fontSize: '11.5px' }}>Employment Year</label>
                    <input type="text" className="form-input" readOnly value={employmentYearFromJoining(editJoining) || '—'} style={{ ...infoInputStyle, background: '#F1F5F9' }} />
                  </div>
                ) : (
                  <>
                    <div className="form-field" style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '11.5px' }}>Academic Year (Articleship)</label>
                      <input type="text" className="form-input" readOnly value={academicYearFromStart(editArtStart, editArtEnd) || '—'} style={{ ...infoInputStyle, background: '#F1F5F9' }} />
                    </div>
                    <div className="form-field" style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '11.5px' }}>Articleship Start</label>
                      <input type="date" className="form-input" value={editArtStart} onChange={e => setEditArtStart(e.target.value)} style={infoInputStyle} />
                    </div>
                    <div className="form-field" style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '11.5px' }}>Articleship End</label>
                      <input type="date" className="form-input" value={editArtEnd} onChange={e => setEditArtEnd(e.target.value)} style={infoInputStyle} />
                    </div>
                    <div className="form-field" style={{ gridColumn: 'span 3' }}>
                      <label style={{ fontSize: '11.5px' }}>Principal</label>
                      <select className="form-select" value={editPrincipal} onChange={e => setEditPrincipal(e.target.value)} style={infoInputStyle}>
                        <option value="">Select…</option>
                        {PRINCIPALS.map(p => (
                          <option key={p} value={p}>{p}, FCA</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                  </>
                )}
                <div className="form-field" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11.5px' }}>Laptop Available</label>
                  <select className="form-select" value={editLaptopAvail} onChange={e => setEditLaptopAvail(e.target.value)} style={infoInputStyle}>
                    <option value="">Select…</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                    {editLaptopAvail && !['Yes', 'No'].includes(editLaptopAvail) && <option value={editLaptopAvail}>{editLaptopAvail}</option>}
                  </select>
                </div>
                <div className="form-field" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11.5px' }}>Laptop Ownership</label>
                  <input type="text" className="form-input" value={editLaptopOwner} onChange={e => setEditLaptopOwner(e.target.value)} placeholder="e.g. Own / Office" style={infoInputStyle} />
                </div>
                <div className="form-field" style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '11.5px' }}>Laptop ID</label>
                  <input type="text" className="form-input" value={editLaptopId} onChange={e => setEditLaptopId(e.target.value)} style={infoInputStyle} />
                </div>
                <div className="form-field" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '11.5px' }}>Remarks</label>
                  <input type="text" className="form-input" value={editRemarks} onChange={e => setEditRemarks(e.target.value)} style={infoInputStyle} />
                </div>
              </div>
            </div>
            )}

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

      {/* Add Client Modal (AD and above / Admin) */}
      <Modal isOpen={isAddClientOpen} onClose={() => setIsAddClientOpen(false)} title={editingClientId ? 'Edit Client' : 'Add Client'} maxWidth="460px">
        <form onSubmit={handleAddClient}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {addClientError && <div className="auth-alert-error">{addClientError}</div>}
            <div className="form-field">
              <label>Client / Company Name</label>
              <input
                type="text"
                value={newClientName}
                onChange={e => setNewClientName(e.target.value)}
                className="form-input"
                placeholder="e.g. Walton Plaza"
                autoFocus
                required
              />
            </div>
            <div className="form-field">
              <label>{editingClientId ? 'Job ID' : 'Job ID (optional)'}</label>
              <input
                type="text"
                value={newClientJobNumber}
                onChange={e => setNewClientJobNumber(e.target.value)}
                className="form-input"
                placeholder={editingClientId ? 'e.g. C-25066' : 'e.g. C-25066 (auto-generated if left blank)'}
              />
            </div>
            {editingClientId && (
              <div className="form-field">
                <label>Engagement Status</label>
                <select
                  value={newClientStatus}
                  onChange={e => setNewClientStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                  className="form-select"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddClientOpen(false)} disabled={isSavingClient}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSavingClient} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {editingClientId ? <Edit3 size={14} /> : <Plus size={14} />}{' '}
              {isSavingClient ? 'Saving…' : editingClientId ? 'Save Changes' : 'Add Client'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Completed Tasks Archive Modal Window */}
      <CompletedTasksModal
        isOpen={isCompletedModalOpen}
        onClose={() => setIsCompletedModalOpen(false)}
        tasks={completedTasks}
        title={`Completed Tasks — ${currentUser.name}`}
      />
    </div>
  );
};
