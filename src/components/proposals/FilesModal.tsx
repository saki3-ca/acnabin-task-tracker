import React, { useState } from 'react';
import { Download, FileText, Trash2 } from 'lucide-react';
import { deleteFromDrive, downloadFromDrive, fmtSize } from '../../lib/driveFiles';
import { proposalService } from '../../services/proposalService';
import { Proposal, ProposalAttachment } from '../../types';
import { Modal } from '../ui/Modal';

interface Props {
  proposal: Proposal | null;
  files: ProposalAttachment[];
  driveUrl: string;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
}

/** The files of one proposal: anyone with access can download, only Admin can delete. */
export const FilesModal: React.FC<Props> = ({ proposal, files, driveUrl, isAdmin, onClose, onChanged }) => {
  const [working, setWorking] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const download = async (a: ProposalAttachment) => {
    setWorking(a.id);
    setProgress(0);
    setError(null);
    try {
      await downloadFromDrive(driveUrl, a.driveFileId, a.fileName, setProgress);
    } catch (e: any) {
      setError(e?.message || 'Could not download.');
    } finally {
      setWorking(null);
    }
  };

  const remove = async (a: ProposalAttachment) => {
    if (!window.confirm(`Delete "${a.fileName}"? It will also be removed from Google Drive.`)) return;
    setWorking(a.id);
    setError(null);
    try {
      await deleteFromDrive(driveUrl, a.driveFileId);
      await proposalService.removeAttachment(a.id);
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Could not delete.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <Modal isOpen={Boolean(proposal)} onClose={onClose} title="Attachments" maxWidth="560px">
      <div className="modal-body">
        <div style={{ fontSize: '13px', fontWeight: 600 }}>{proposal?.name}</div>
        <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '-6px' }}>{proposal?.client}</div>
        {files.length === 0 && <div style={{ fontSize: '13px', color: 'var(--ink-muted)' }}>No files attached.</div>}
        {files.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '8px', background: '#FAF8F5' }}>
            <FileText size={16} color="var(--navy)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', overflowWrap: 'anywhere' }}>{a.fileName}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)' }}>
                {fmtSize(a.size)}{a.uploadedBy ? ` · ${a.uploadedBy}` : ''}
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" disabled={working !== null} onClick={() => download(a)} title="Download">
              {working === a.id ? `${Math.round(progress * 100)}%` : <Download size={14} />}
            </button>
            {isAdmin && (
              <button className="btn btn-secondary btn-sm" disabled={working !== null} onClick={() => remove(a)} title="Delete (Admin)" style={{ color: '#B91C1C' }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        {error && <div className="auth-alert-error" style={{ margin: 0 }}>{error}</div>}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
};
