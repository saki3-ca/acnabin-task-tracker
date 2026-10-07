import React, { useRef, useState } from 'react';
import { Download, ExternalLink, FileText, Paperclip, Trash2 } from 'lucide-react';
import { deleteFromDrive, downloadFromDrive, fmtSize, MAX_FILE_BYTES } from '../../lib/driveFiles';
import { uploadQueue } from '../../lib/uploadQueue';
import { invoiceService } from '../../services/invoiceService';
import { Invoice, InvoiceAttachment } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';

interface Props {
  invoice: Invoice | null;
  kind: 'VDS' | 'TDS';
  files: InvoiceAttachment[];
  driveUrl: string;
  isAdmin: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const isLink = (s: string) => /^https?:\/\//i.test((s || '').trim());

/** The challan files of one invoice (VDS or TDS). Old data keeps its Drive link at the top. */
export const InvoiceFilesModal: React.FC<Props> = ({ invoice, kind, files, driveUrl, isAdmin, onClose, onChanged }) => {
  const { currentUser } = useAuth();
  const [working, setWorking] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const pick = useRef<HTMLInputElement>(null);

  const legacy = invoice ? (kind === 'VDS' ? invoice.vdsChallanLink : invoice.tdsChallanLink).trim() : '';

  const download = async (a: InvoiceAttachment) => {
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

  const remove = async (a: InvoiceAttachment) => {
    if (!window.confirm(`Delete "${a.fileName}"? It will also be removed from Google Drive.`)) return;
    setWorking(a.id);
    setError(null);
    try {
      await deleteFromDrive(driveUrl, a.driveFileId);
      await invoiceService.removeAttachment(a.id);
      onChanged();
    } catch (e: any) {
      setError(e?.message || 'Could not delete.');
    } finally {
      setWorking(null);
    }
  };

  const add = (list: FileList | null) => {
    if (!list || !invoice) return;
    const ok: File[] = [];
    const bad: string[] = [];
    Array.from(list).forEach(f => (f.size === 0 || f.size > MAX_FILE_BYTES ? bad.push(f.name) : ok.push(f)));
    setNote(bad.length ? `Not added (empty or bigger than 100 MB): ${bad.join(', ')}` : ok.length ? 'Uploading in the background. You can close this window.' : null);
    if (ok.length) uploadQueue.addInvoice(driveUrl, { id: invoice.id, invoiceNo: invoice.invoiceNo, kind }, ok);
    if (pick.current) pick.current.value = '';
  };

  return (
    <Modal isOpen={Boolean(invoice)} onClose={onClose} title={`${kind} challan files`} maxWidth="560px">
      <div className="modal-body">
        <div style={{ fontSize: '13px', fontWeight: 600 }}>{invoice?.invoiceNo}</div>
        <div style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '-6px' }}>{invoice?.client}</div>

        {legacy && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '8px', background: '#F8FAFC' }}>
            <ExternalLink size={16} color="var(--navy)" />
            <div style={{ flex: 1, minWidth: 0, fontSize: '13px', overflowWrap: 'anywhere' }}>
              {isLink(legacy) ? (
                <a href={legacy} target="_blank" rel="noreferrer" style={{ fontWeight: 600 }}>Existing Google Drive link ↗</a>
              ) : (
                <span>{legacy}</span>
              )}
            </div>
          </div>
        )}

        {files.length === 0 && !legacy && <div style={{ fontSize: '13px', color: 'var(--ink-muted)' }}>No files attached.</div>}
        {files.map(a => (
          <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', border: '1px solid var(--line)', borderRadius: '8px', background: '#FAF8F5' }}>
            <FileText size={16} color="var(--navy)" />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', overflowWrap: 'anywhere' }}>{a.fileName}</div>
              <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)' }}>{fmtSize(a.size)}{a.uploadedBy ? ` · ${a.uploadedBy}` : ''}</div>
            </div>
            <button className="btn btn-secondary btn-sm" disabled={working !== null} onClick={() => download(a)} title="Download">
              {working === a.id ? `${Math.round(progress * 100)}%` : <Download size={14} />}
            </button>
            {(isAdmin || (a.uploadedById && a.uploadedById === currentUser?.id)) && (
              <button className="btn btn-secondary btn-sm" disabled={working !== null} onClick={() => remove(a)} title={isAdmin ? 'Delete (Admin)' : 'Delete the file you uploaded'} style={{ color: '#B91C1C' }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}

        <div>
          <input ref={pick} type="file" multiple style={{ display: 'none' }} onChange={e => add(e.target.files)} />
          <button className="btn btn-secondary btn-sm" disabled={!driveUrl} onClick={() => pick.current?.click()} title={driveUrl ? undefined : 'Admin has not set the Drive upload link yet'}>
            <Paperclip size={13} /> Add {kind} files
          </button>
          {!driveUrl && <span style={{ fontSize: '12px', color: 'var(--ink-muted)', marginLeft: '8px' }}>Drive upload link is not set yet (Admin Panel → Tab Access).</span>}
        </div>
        {note && <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>{note}</div>}
        {error && <div className="auth-alert-error" style={{ margin: 0 }}>{error}</div>}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={onClose}>Close</button>
      </div>
    </Modal>
  );
};
