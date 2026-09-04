import React, { useEffect, useState } from 'react';
import { Building, Check, Key, Shield, UserCog, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { DESIGNATIONS, ROLES } from '../../lib/constants';
import { isManagementDesignation, isSAMOrAbove } from '../../lib/permissions';
import { adminService } from '../../services/adminService';
import { clientService } from '../../services/clientService';
import { Designation, ManagerAccessItem, ManagerStudentItem, Role, User } from '../../types';
import { Modal } from '../ui/Modal';

export const AdminPanel: React.FC = () => {
  const { allUsers, allClients, refreshContextData } = useAuth();

  // Local state for user edits before saving
  const [userEdits, setUserEdits] = useState<Record<string, Partial<User>>>({});
  const [editingClientAssignmentsUser, setEditingClientAssignmentsUser] = useState<User | null>(null);
  const [clientSearchFilter, setClientSearchFilter] = useState<string>('');
  const [selectedManagerForClients, setSelectedManagerForClients] = useState<string>('');
  const [managerClients, setManagerClients] = useState<ManagerAccessItem[]>([]);
  const [selectedManagerForStudents, setSelectedManagerForStudents] = useState<string>('');
  const [managerStudents, setManagerStudents] = useState<ManagerStudentItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const managers = allUsers.filter(
    u => u.role === 'ADMIN' || isManagementDesignation(u.designation)
  );

  const showNotice = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  const getUserAssignedClientIds = (user: User): string[] => {
    const current = userEdits[user.id]?.assignedClientIds ?? user.assignedClientIds;
    if (current && Array.isArray(current)) return current;
    if (user.signupClientId) {
      return user.signupClientId.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [];
  };

  const toggleUserClientAssignment = (userId: string, clientId: string) => {
    const user = allUsers.find(u => u.id === userId);
    if (!user) return;
    const current = getUserAssignedClientIds(user);
    let updated: string[];
    if (current.includes(clientId)) {
      updated = current.filter(id => id !== clientId);
    } else {
      updated = [...current, clientId];
    }
    handleUserChange(userId, 'assignedClientIds', updated);
    handleUserChange(userId, 'signupClientId', updated.join(', '));
  };

  const handleSaveUserClientAssignments = async (user: User) => {
    setIsSaving(true);
    try {
      const currentIds = getUserAssignedClientIds(user);
      await adminService.updateUser(user.id, {
        assignedClientIds: currentIds,
        signupClientId: currentIds.join(', ')
      });
      await refreshContextData();
      showNotice(`Client assignments for ${user.name} saved successfully!`);
      setEditingClientAssignmentsUser(null);
    } catch (err: any) {
      showNotice(err.message || 'Failed to save client assignments');
    } finally {
      setIsSaving(false);
    }
  };

  // 1. Manager Client Access Loading
  useEffect(() => {
    if (selectedManagerForClients) {
      adminService.getManagerClients(selectedManagerForClients).then(setManagerClients);
    } else {
      setManagerClients([]);
    }
  }, [selectedManagerForClients]);

  // 2. Manager Student Access Loading
  useEffect(() => {
    if (selectedManagerForStudents) {
      adminService.getManagerStudents(selectedManagerForStudents).then(setManagerStudents);
    } else {
      setManagerStudents([]);
    }
  }, [selectedManagerForStudents]);

  // Toggle client permission in matrix
  const toggleClientAccess = (clientId: string) => {
    setManagerClients(prev =>
      prev.map(c => (c.clientId === clientId ? { ...c, hasAccess: !c.hasAccess } : c))
    );
  };

  const handleSaveManagerClients = async () => {
    if (!selectedManagerForClients) return;
    setIsSaving(true);
    try {
      const selectedIds = managerClients.filter(c => c.hasAccess).map(c => c.clientId);
      await adminService.saveManagerClients(selectedManagerForClients, selectedIds);
      showNotice('Manager client access permissions saved successfully.');
    } catch (err: any) {
      showNotice(err.message || 'Error saving client access');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle student assignment in matrix
  const toggleStudentAccess = (studentId: string) => {
    setManagerStudents(prev =>
      prev.map(s => (s.studentId === studentId ? { ...s, isAssigned: !s.isAssigned } : s))
    );
  };

  const handleSaveManagerStudents = async () => {
    if (!selectedManagerForStudents) return;
    setIsSaving(true);
    try {
      const selectedIds = managerStudents.filter(s => s.isAssigned).map(s => s.studentId);
      await adminService.saveManagerStudents(selectedManagerForStudents, selectedIds);
      showNotice('Manager student assignments saved successfully.');
    } catch (err: any) {
      showNotice(err.message || 'Error saving student assignments');
    } finally {
      setIsSaving(false);
    }
  };

  // User Field Updates
  const handleUserChange = (userId: string, field: keyof User, value: any) => {
    setUserEdits(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  };

  const handleSaveAllUserChanges = async () => {
    const userIds = Object.keys(userEdits);
    if (userIds.length === 0) {
      showNotice('No user changes to save.');
      return;
    }

    setIsSaving(true);
    try {
      await Promise.all(
        userIds.map(uid => adminService.updateUser(uid, userEdits[uid]))
      );
      setUserEdits({});
      await refreshContextData();
      showNotice('All user profile and role updates saved.');
    } catch (err: any) {
      showNotice(err.message || 'Failed to update users');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="banner-strip banner-teal">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <Shield size={16} />
          <span>FIRM ADMINISTRATION & ACCESS MATRICES</span>
        </div>
        {feedbackMsg && (
          <span
            style={{
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: '#fff',
              color: 'var(--teal-dark)',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px'
            }}
          >
            {feedbackMsg}
          </span>
        )}
      </div>

      {/* 1. Manager Client Access Matrix */}
      <div className="table-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--navy)' }}>
          <Key size={18} /> Manager Client Access Control
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px', marginBottom: '16px' }}>
          Select a manager or supervisor to configure which client audit engagements they can view and supervise.
        </p>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <select
            value={selectedManagerForClients}
            onChange={e => setSelectedManagerForClients(e.target.value)}
            className="form-select"
            style={{ maxWidth: '280px' }}
          >
            <option value="">Select Manager / Supervisor…</option>
            {managers.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.designation})
              </option>
            ))}
          </select>

          {selectedManagerForClients && (
            <button className="btn btn-teal btn-sm" onClick={handleSaveManagerClients} disabled={isSaving}>
              <Check size={14} /> Save Client Access
            </button>
          )}
        </div>

        {selectedManagerForClients && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '10px' }}>
            {managerClients.map(item => (
              <label
                key={item.clientId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: item.hasAccess ? '#E6F5F5' : '#FAF8F5',
                  border: `1px solid ${item.hasAccess ? 'var(--teal)' : 'var(--line)'}`,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="checkbox"
                  checked={item.hasAccess}
                  onChange={() => toggleClientAccess(item.clientId)}
                />
                <span style={{ fontWeight: item.hasAccess ? 600 : 400 }}>{item.clientName}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 2. Manager Student Assignments */}
      <div className="table-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--navy)' }}>
          <Users size={18} /> Manager Student Supervisory Assignments
        </h3>
        <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px', marginBottom: '16px' }}>
          Assign articled students and trainees to specific managers for team task review and task delegation.
        </p>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
          <select
            value={selectedManagerForStudents}
            onChange={e => setSelectedManagerForStudents(e.target.value)}
            className="form-select"
            style={{ maxWidth: '280px' }}
          >
            <option value="">Select Manager / Supervisor…</option>
            {managers.map(m => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.designation})
              </option>
            ))}
          </select>

          {selectedManagerForStudents && (
            <button className="btn btn-teal btn-sm" onClick={handleSaveManagerStudents} disabled={isSaving}>
              <Check size={14} /> Save Student Assignments
            </button>
          )}
        </div>

        {selectedManagerForStudents && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '10px' }}>
            {managerStudents.map(item => (
              <label
                key={item.studentId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: item.isAssigned ? '#EBF0FE' : '#FAF8F5',
                  border: `1px solid ${item.isAssigned ? 'var(--navy)' : 'var(--line)'}`,
                  padding: '8px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12.5px',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="checkbox"
                  checked={item.isAssigned}
                  onChange={() => toggleStudentAccess(item.studentId)}
                />
                <div>
                  <div style={{ fontWeight: item.isAssigned ? 600 : 400 }}>{item.studentName}</div>
                  <div style={{ fontSize: '11px', color: 'var(--ink-soft)' }}>{item.empId}</div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* 3. User Management */}
      <div className="table-card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--maroon)' }}>
              <UserCog size={18} /> User Accounts, Designations & Roles
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '2px' }}>
              Update designations, security roles, primary client mapping, and account activation states.
            </p>
          </div>
          <button className="btn btn-primary btn-sm" onClick={handleSaveAllUserChanges} disabled={isSaving}>
            <Check size={14} /> Save User Changes
          </button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name & ID</th>
                <th>Email</th>
                <th style={{ width: '180px' }}>Designation</th>
                <th style={{ width: '130px' }}>Role</th>
                <th style={{ width: '210px' }}>Assigned Clients</th>
                <th style={{ width: '120px' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {allUsers.map(user => {
                const currentEdits = userEdits[user.id] || {};
                const designation = currentEdits.designation ?? user.designation;
                const role = currentEdits.role ?? user.role;
                const status = currentEdits.status ?? user.status;
                const assignedIds = getUserAssignedClientIds(user);

                return (
                  <tr key={user.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{user.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--ink-muted)', fontFamily: 'monospace' }}>
                        {user.designation === 'Partner'
                          ? `# Initial: ${user.empId}`
                          : user.role === 'ADMIN'
                          ? `Admin ID: ${user.empId}`
                          : user.empId}
                      </div>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{user.email}</td>
                    <td>
                      <select
                        value={designation}
                        onChange={e => handleUserChange(user.id, 'designation', e.target.value as Designation)}
                        className="form-select"
                        style={{ fontSize: '11.5px', padding: '4px 8px' }}
                      >
                        {DESIGNATIONS.map(d => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select
                        value={role}
                        onChange={e => handleUserChange(user.id, 'role', e.target.value as Role)}
                        className="form-select"
                        style={{ fontSize: '11.5px', padding: '4px 8px' }}
                      >
                        {ROLES.map(r => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditingClientAssignmentsUser(user);
                          setClientSearchFilter('');
                        }}
                        style={{
                          fontSize: '11.5px',
                          padding: '5px 10px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          width: '100%',
                          justifyContent: 'space-between'
                        }}
                        title="Click to assign or edit client engagements for this user"
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {assignedIds.length === 0 ? (
                            <span style={{ color: 'var(--ink-soft)' }}>+ Assign Clients</span>
                          ) : (
                            <span style={{ fontWeight: 600, color: 'var(--navy)' }}>
                              🏢 {assignedIds.length} {assignedIds.length === 1 ? 'Client' : 'Clients'}
                            </span>
                          )}
                        </span>
                        <span style={{ fontSize: '10.5px', color: 'var(--maroon)', fontWeight: 600 }}>Edit</span>
                      </button>
                    </td>
                    <td>
                      <select
                        value={status}
                        onChange={e => handleUserChange(user.id, 'status', e.target.value as 'ACTIVE' | 'INACTIVE')}
                        className="form-select"
                        style={{
                          fontSize: '11.5px',
                          padding: '4px 8px',
                          fontWeight: 600,
                          color: status === 'ACTIVE' ? '#166534' : '#991B1B'
                        }}
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Multi-Client Assignment Modal */}
      {editingClientAssignmentsUser && (
        <Modal
          isOpen={Boolean(editingClientAssignmentsUser)}
          onClose={() => setEditingClientAssignmentsUser(null)}
          title={`Assign Clients: ${editingClientAssignmentsUser.name}`}
        >
          <div className="modal-body">
            <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', margin: 0 }}>
              Select one or multiple client engagements for <strong>{editingClientAssignmentsUser.name}</strong> ({editingClientAssignmentsUser.empId}).
            </p>

            <input
              type="text"
              className="form-input"
              placeholder="Search clients by name or job number..."
              value={clientSearchFilter}
              onChange={e => setClientSearchFilter(e.target.value)}
              style={{ fontSize: '12.5px' }}
            />

            <div
              style={{
                maxHeight: '260px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                border: '1px solid var(--line)',
                padding: '10px',
                borderRadius: '6px'
              }}
            >
              {allClients
                .filter(
                  c =>
                    c.name.toLowerCase().includes(clientSearchFilter.toLowerCase()) ||
                    (c.jobNumber && c.jobNumber.toLowerCase().includes(clientSearchFilter.toLowerCase()))
                )
                .map(client => {
                  const assigned = getUserAssignedClientIds(editingClientAssignmentsUser).includes(client.id);
                  return (
                    <label
                      key={client.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        background: assigned ? 'var(--navy-light, #EBF0FE)' : '#fff',
                        border: `1px solid ${assigned ? 'var(--navy, #1B2A6B)' : 'var(--line)'}`,
                        cursor: 'pointer',
                        fontSize: '12.5px'
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={assigned}
                        onChange={() =>
                          toggleUserClientAssignment(editingClientAssignmentsUser.id, client.id)
                        }
                      />
                      <span style={{ fontWeight: assigned ? 600 : 400 }}>{client.name}</span>
                      {client.jobNumber && (
                        <span style={{ fontSize: '11px', color: 'var(--ink-soft)', marginLeft: 'auto' }}>
                          {client.jobNumber}
                        </span>
                      )}
                    </label>
                  );
                })}
            </div>
          </div>
          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '12px', color: 'var(--navy)', fontWeight: 600 }}>
              {getUserAssignedClientIds(editingClientAssignmentsUser).length} Client(s) Selected
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditingClientAssignmentsUser(null)}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isSaving}
                onClick={() => handleSaveUserClientAssignments(editingClientAssignmentsUser)}
              >
                <Check size={14} /> {isSaving ? 'Saving…' : 'Save Client Assignments'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
