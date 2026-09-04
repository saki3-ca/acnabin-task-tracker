import React, { useEffect, useState } from 'react';
import { Briefcase, Building, Edit, Plus, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { canViewAllClients } from '../../lib/permissions';
import { adminService } from '../../services/adminService';
import { clientService } from '../../services/clientService';
import { Client } from '../../types';
import { Modal } from '../ui/Modal';

export const ClientGrid: React.FC = () => {
  const { currentUser, allClients, refreshContextData } = useAuth();
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientName, setClientName] = useState('');
  const [jobNumber, setJobNumber] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignedClientIds, setAssignedClientIds] = useState<string[]>([]);
  const [isLoadingAccess, setIsLoadingAccess] = useState(false);

  const canSeeAll = canViewAllClients(currentUser);

  useEffect(() => {
    if (currentUser && !canSeeAll) {
      setIsLoadingAccess(true);
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
          const clientSet = new Set<string>();
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
        .finally(() => setIsLoadingAccess(false));
    }
  }, [currentUser, canSeeAll]);

  const visibleClients = canSeeAll
    ? allClients
    : allClients.filter(c => assignedClientIds.includes(c.id));

  const openAdd = () => {
    setSelectedClient(null);
    setClientName('');
    setJobNumber('');
    setStatus('ACTIVE');
    setIsModalOpen(true);
  };

  const openEdit = (client: Client) => {
    setSelectedClient(client);
    setClientName(client.name);
    setJobNumber(client.jobNumber || '');
    setStatus(client.status);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim()) return;

    setIsSubmitting(true);
    try {
      if (selectedClient) {
        await clientService.updateClient(selectedClient.id, {
          name: clientName,
          jobNumber,
          status
        });
      } else {
        await clientService.addClient(clientName, jobNumber);
      }
      await refreshContextData();
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <div className="banner-strip banner-navy">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
          <Building size={16} />
          <span>
            {canSeeAll
              ? 'ALL CLIENT ENGAGEMENTS (FIRM-WIDE DIRECTORY)'
              : 'MY ASSIGNED CLIENT ENGAGEMENTS'}
          </span>
        </div>
        {canSeeAll && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={openAdd}
            style={{
              position: 'absolute',
              right: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--ink)'
            }}
          >
            <Plus size={14} /> Add Client
          </button>
        )}
      </div>

      {isLoadingAccess ? (
        <div className="loading-indicator" style={{ padding: '40px' }}>
          Loading your assigned clients…
        </div>
      ) : visibleClients.length === 0 ? (
        <div className="table-card" style={{ padding: '36px 20px', textAlign: 'center' }}>
          <ShieldAlert size={32} color="var(--ink-soft)" style={{ margin: '0 auto 12px' }} />
          <h4 style={{ fontSize: '15px', color: 'var(--ink)' }}>No Clients Assigned Yet</h4>
          <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', maxWidth: '420px', margin: '6px auto 0' }}>
            You do not currently have any client audit engagements assigned to your profile.
            Please ask an Administrator or Director to configure your client access.
          </p>
        </div>
      ) : (
        <div className="client-card-grid">
          {visibleClients.map(client => (
          <div key={client.id} className="client-card">
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span className="client-card-name">{client.name}</span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: client.status === 'ACTIVE' ? '#DCFCE7' : '#F3F4F6',
                    color: client.status === 'ACTIVE' ? '#166534' : '#4B5563'
                  }}
                >
                  {client.status}
                </span>
              </div>
              <div className="client-card-job">
                Job Number: <strong>{client.jobNumber || 'Unassigned'}</strong>
              </div>
            </div>

            {currentUser?.role === 'ADMIN' && (
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => openEdit(client)}
                  style={{ padding: '4px 10px', fontSize: '11.5px' }}
                >
                  <Edit size={12} style={{ marginRight: 4 }} /> Edit
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {/* Add / Edit Client Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedClient ? 'Edit Client Details' : 'Add New Client'}
      >
        <form onSubmit={handleSave}>
          <div className="modal-body">
            <div className="form-field">
              <label>Client Corporate Name</label>
              <input
                type="text"
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                className="form-input"
                placeholder="e.g. Apex Footwear Limited"
                required
              />
            </div>

            <div className="form-field">
              <label>Audit Job Number</label>
              <input
                type="text"
                value={jobNumber}
                onChange={e => setJobNumber(e.target.value)}
                className="form-input"
                placeholder="e.g. C-26010"
              />
            </div>

            <div className="form-field">
              <label>Status</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as 'ACTIVE' | 'INACTIVE')}
                className="form-select"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save Client'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
