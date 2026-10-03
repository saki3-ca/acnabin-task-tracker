import { clientText } from '../ui/ClientLabel';
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTasks } from '../../context/TaskContext';
import { formatHrmId, getUserAssignedClientIds, hasTeamAccess, isAssistantDirectorOrAbove } from '../../lib/permissions';
import { adminService } from '../../services/adminService';
import { Client, User } from '../../types';

interface TaskFilterBarProps {
  onOpenAssignModal: () => void;
  /** How many tasks the table below shows */
  shownCount?: number;
}

export const TaskFilterBar: React.FC<TaskFilterBarProps> = ({ onOpenAssignModal, shownCount }) => {
  const { currentUser, allClients, allUsers } = useAuth();
  const { teamFilters, setTeamFilters } = useTasks();

  const isADPlus = currentUser ? (currentUser.role === 'ADMIN' || isAssistantDirectorOrAbove(currentUser.designation)) : false;
  const isSupervisorToManager = currentUser ? hasTeamAccess(currentUser) && !isADPlus : false;

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

  const searchTerm = teamFilters.searchTerm || '';
  const hasActiveFilters = Boolean(teamFilters.clientId || teamFilters.memberId || searchTerm.trim() || (teamFilters.status && teamFilters.status !== 'All'));
  const clearFilters = () => setTeamFilters({ status: 'All' });
  const selectStyle: React.CSSProperties = { height: '36px', fontSize: '12.5px', width: '100%' };

  return (
    <div
      className="filter-bar"
      style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff', padding: '12px 18px', borderRadius: '8px', border: '1px solid var(--line)' }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', flex: 1 }}>
        <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 240px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)' }} />
          <input
            type="text"
            className="form-input"
            style={{ paddingLeft: '32px', height: '36px', fontSize: '12.5px', width: '100%' }}
            placeholder="Search task, client or team member…"
            value={searchTerm}
            onChange={e => setTeamFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
          />
        </div>

        <div style={{ minWidth: '180px', flex: '1 1 180px' }}>
          <select value={teamFilters.clientId || ''} onChange={handleClientChange} className="form-select" style={selectStyle}>
            <option value="">All Clients</option>
            {allowedClients.map(c => (
              <option key={c.id} value={c.id}>
                {clientText(c.name, c.jobNumber)}
              </option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: '200px', flex: '1 1 220px' }}>
          <select value={teamFilters.memberId || ''} onChange={handleMemberChange} className="form-select" style={selectStyle}>
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

        <div style={{ minWidth: '140px', flex: '1 1 140px' }}>
          <select value={teamFilters.status || 'All'} onChange={handleStatusChange} className="form-select" style={selectStyle}>
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="btn btn-secondary btn-sm"
            style={{ height: '36px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}
            title="Reset all filters"
          >
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {shownCount !== undefined && (
          <span style={{ fontSize: '12px', color: 'var(--ink-soft)', fontWeight: 600 }}>
            Showing {shownCount} task{shownCount === 1 ? '' : 's'}
          </span>
        )}
        <button
          className="btn btn-primary btn-sm"
          onClick={onOpenAssignModal}
          style={{ height: '36px', padding: '0 16px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600 }}
        >
          <Plus size={15} /> Assign Task
        </button>
      </div>
    </div>
  );
};
