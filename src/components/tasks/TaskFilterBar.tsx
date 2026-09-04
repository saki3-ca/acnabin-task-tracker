import React, { useEffect, useState } from 'react';
import { Filter, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { isAssistantDirectorOrAbove, isInChargeOrAbove } from '../../lib/permissions';
import { adminService } from '../../services/adminService';
import { Client, User } from '../../types';

interface TaskFilterBarProps {
  onOpenAssignModal: () => void;
}

export const TaskFilterBar: React.FC<TaskFilterBarProps> = ({ onOpenAssignModal }) => {
  const { currentUser, allClients, allUsers } = useAuth();
  const { teamFilters, setTeamFilters } = useTasks();

  // Scoped client + member lists for Supervisor-to-Manager
  const [allowedClients, setAllowedClients] = useState<Client[]>([]);
  const [allowedMembers, setAllowedMembers] = useState<User[]>([]);

  const isADPlus = currentUser ? (currentUser.role === 'ADMIN' || isAssistantDirectorOrAbove(currentUser.designation)) : false;
  const isSupervisorToManager = currentUser ? isInChargeOrAbove(currentUser.designation) && !isADPlus : false;

  useEffect(() => {
    if (!currentUser) return;

    if (isADPlus) {
      // AD and above: show all clients and all audit team members (excluding Admin)
      setAllowedClients(allClients);
      setAllowedMembers(allUsers.filter(u => u.role !== 'ADMIN' && u.designation !== 'Admin'));
    } else if (isSupervisorToManager) {
      // Supervisor to Manager: only their assigned clients and users on those clients
      adminService.getManagerClientIds(currentUser.id).then(clientIds => {
        const scopedClients = allClients.filter(c => clientIds.includes(c.id));
        setAllowedClients(scopedClients);

        // Show only users who have one of the allowed clients as their signupClientId
        // (i.e., students/members working on those clients)
        const lowerRank = ['Student', 'In Charge', 'Supervisor', 'Senior Assistant Manager', 'Deputy Manager', 'Manager'];
        const scopedMembers = allUsers.filter(u => {
          if (!lowerRank.includes(u.designation)) return false;
          // Check if user is assigned to any of the manager's clients
          const userClientIds = u.assignedClientIds ||
            (u.signupClientId ? u.signupClientId.split(',').map(s => s.trim()).filter(Boolean) : []);
          return userClientIds.some(cid => clientIds.includes(cid));
        });
        setAllowedMembers(scopedMembers);
      }).catch(() => {
        setAllowedClients([]);
        setAllowedMembers([]);
      });
    }
  }, [currentUser, allClients, allUsers, isADPlus, isSupervisorToManager]);

  const handleClientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTeamFilters(prev => ({ ...prev, clientId: e.target.value || undefined }));
  };

  const handleMemberChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTeamFilters(prev => ({ ...prev, memberId: e.target.value || undefined }));
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setTeamFilters(prev => ({ ...prev, status: e.target.value }));
  };

  return (
    <div className="filter-bar">
      {/* Client Filter */}
      <div className="filter-group">
        <label className="filter-label">Client</label>
        <select
          value={teamFilters.clientId || ''}
          onChange={handleClientChange}
          className="form-select"
          style={{ width: 'auto', minWidth: '160px', padding: '6px 10px', fontSize: '12px' }}
        >
          <option value="">All Clients</option>
          {allowedClients.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Member Filter */}
      <div className="filter-group">
        <label className="filter-label">Team Member</label>
        <select
          value={teamFilters.memberId || ''}
          onChange={handleMemberChange}
          className="form-select"
          style={{ width: 'auto', minWidth: '160px', padding: '6px 10px', fontSize: '12px' }}
        >
          <option value="">All Team Members</option>
          {allowedMembers.map(u => (
            <option key={u.id} value={u.id}>
              {u.name} ({u.empId})
            </option>
          ))}
        </select>
      </div>

      {/* Status Filter */}
      <div className="filter-group">
        <label className="filter-label">Status</label>
        <select
          value={teamFilters.status || 'All'}
          onChange={handleStatusChange}
          className="form-select"
          style={{ width: 'auto', minWidth: '120px', padding: '6px 10px', fontSize: '12px' }}
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {/* Action Button */}
      <div style={{ marginLeft: 'auto' }}>
        <button className="btn btn-primary btn-sm" onClick={onOpenAssignModal}>
          <Plus size={14} /> Assign Task
        </button>
      </div>
    </div>
  );
};
