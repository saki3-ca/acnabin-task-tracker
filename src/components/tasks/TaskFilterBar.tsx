import React, { useEffect, useMemo, useState } from 'react';
import { Filter, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { formatHrmId, getUserAssignedClientIds, isAssistantDirectorOrAbove, isInChargeOrAbove } from '../../lib/permissions';
import { adminService } from '../../services/adminService';
import { Client, User } from '../../types';

interface TaskFilterBarProps {
  onOpenAssignModal: () => void;
}

export const TaskFilterBar: React.FC<TaskFilterBarProps> = ({ onOpenAssignModal }) => {
  const { currentUser, allClients, allUsers } = useAuth();
  const { teamFilters, setTeamFilters } = useTasks();

  const isADPlus = currentUser ? (currentUser.role === 'ADMIN' || isAssistantDirectorOrAbove(currentUser.designation)) : false;
  const isSupervisorToManager = currentUser ? isInChargeOrAbove(currentUser.designation) && !isADPlus : false;

  const [managerClientIds, setManagerClientIds] = useState<string[]>(() => {
    if (!currentUser) return [];
    const cached = adminService.getCachedManagerClientIds(currentUser.id);
    const fallback = getUserAssignedClientIds(currentUser);
    const set = new Set<string>([...(cached || []), ...fallback]);
    return Array.from(set);
  });

  useEffect(() => {
    if (!currentUser || !isSupervisorToManager) return;
    adminService.getManagerClientIds(currentUser.id).then(clientIds => {
      const set = new Set<string>([...(clientIds || []), ...getUserAssignedClientIds(currentUser)]);
      setManagerClientIds(Array.from(set));
    }).catch(() => {});
  }, [currentUser, isSupervisorToManager]);

  const allowedClients = useMemo(() => {
    if (!currentUser) return [];
    if (isADPlus) return allClients;
    if (isSupervisorToManager) {
      return allClients.filter(c => managerClientIds.includes(c.id));
    }
    return allClients;
  }, [currentUser, isADPlus, isSupervisorToManager, allClients, managerClientIds]);

  const allowedMembers = useMemo(() => {
    if (!currentUser) return [];
    if (isADPlus) {
      return allUsers.filter(u => u.role !== 'ADMIN' && u.designation !== 'Admin');
    }
    if (isSupervisorToManager) {
      const lowerRank = ['Student', 'In Charge', 'Supervisor', 'Senior Assistant Manager', 'Deputy Manager', 'Manager'];
      return allUsers.filter(u => {
        if (!lowerRank.includes(u.designation)) return false;
        const userClientIds = u.assignedClientIds ||
          (u.signupClientId ? u.signupClientId.split(',').map(s => s.trim()).filter(Boolean) : []);
        return userClientIds.some(cid => managerClientIds.includes(cid));
      });
    }
    return allUsers;
  }, [currentUser, isADPlus, isSupervisorToManager, allUsers, managerClientIds]);

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
    <div
      className="filter-bar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        padding: '12px 18px'
      }}
    >
      {/* Filters Group */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 650px', flexWrap: 'wrap' }}>
        {/* Client Filter */}
        <div className="filter-group" style={{ flex: '1 1 200px', minWidth: '180px' }}>
          <label className="filter-label" style={{ whiteSpace: 'nowrap' }}>Client</label>
          <select
            value={teamFilters.clientId || ''}
            onChange={handleClientChange}
            className="form-select"
            style={{ width: '100%', padding: '7px 12px', fontSize: '12.5px', height: '36px', boxSizing: 'border-box' }}
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
        <div className="filter-group" style={{ flex: '1.5 1 280px', minWidth: '240px' }}>
          <label className="filter-label" style={{ whiteSpace: 'nowrap' }}>Team Member</label>
          <select
            value={teamFilters.memberId || ''}
            onChange={handleMemberChange}
            className="form-select"
            style={{ width: '100%', padding: '7px 12px', fontSize: '12.5px', height: '36px', boxSizing: 'border-box' }}
          >
            <option value="">All Team Members</option>
            {allowedMembers.map(u => {
              const formattedId = formatHrmId(u.empId || u.id, u.designation);
              return (
                <option key={u.id} value={u.id}>
                  {u.name} {formattedId ? `(${formattedId})` : ''}
                </option>
              );
            })}
          </select>
        </div>

        {/* Status Filter */}
        <div className="filter-group" style={{ flex: '0.8 1 140px', minWidth: '130px' }}>
          <label className="filter-label" style={{ whiteSpace: 'nowrap' }}>Status</label>
          <select
            value={teamFilters.status || 'All'}
            onChange={handleStatusChange}
            className="form-select"
            style={{ width: '100%', padding: '7px 12px', fontSize: '12.5px', height: '36px', boxSizing: 'border-box' }}
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Action Button */}
      <div style={{ flexShrink: 0 }}>
        <button
          className="btn btn-primary btn-sm"
          onClick={onOpenAssignModal}
          style={{
            height: '36px',
            padding: '0 16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          <Plus size={15} /> Assign Task
        </button>
      </div>
    </div>
  );
};


