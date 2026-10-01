import React, { useRef, useState } from 'react';
import { Download, FileText, Paperclip, Trash2 } from 'lucide-react';
import { deleteFromDrive, downloadFromDrive, fmtSize, MAX_FILE_BYTES } from '../../lib/driveFiles';
import { proposalService } from '../../services/proposalService';
import { ProposalAttachment } from '../../types';

interface Props {
  /** Files already saved for this proposal (empty for a new one) */
  saved: ProposalAttachment[];
  /** Files picked but not uploaded yet (uploaded when the proposal is saved) */
  queued: File[];
  onQueue: (files: File[]) => void;
  onUnqueue: (index: number) => void;
  driveUrl: string;
  isAdmin: boolean;
  busy: boolean;
  /** 0..1 progress of the upload that is running, by queue index */
  progress: Record<number, number>;
  onChanged: () => void;
}

export const ProposalAttachments: React.FC<Props> = ({ saved, queued, onQueue, onUnqueue, driveUrl, isAdmin, busy, progress, onChanged }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  if (!driveUrl) {
    return (
      <div className="form-field">
        <label>Attachments</label>
        <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '6px', padding: '8px 10px' }}>
          File upload is not set up yet. Ask Admin to add the Drive upload link (Admin Panel → Proposal Tracker Access).
        </div>
      </div>
    );
  }

  const pick = (list: FileList | null) => {
    if (!list) return;
    const ok: File[] = [];
    const bad: string[] = [];
    Array.from(list).forEach(f => (f.size > MAX_FILE_BYTES ? bad.push(f.name) : f.size === 0 ? bad.push(f.name) : ok.push(f)));
    setNote(bad.length ? `Not added (empty or bigger than 100 MB): ${bad.join(', ')}` : null);
    if (ok.length) onQueue(ok);
    if (fileRef.current) fileRef.current.value = '';
  };

  const download = async (a: ProposalAttachment) => {
    setWorking(a.id);
    setNote(null);
    try {
      await downloadFromDrive(driveUrl, a.driveFileId, a.fileName);
    } catch (e: any) {
      setNote(e?.message || 'Could not download.');
    } finally {
      setWorking(null);
    }
  };

  const remove = async (a: ProposalAttachment) => {
    if (!window.confirm(`Delete "${a.fileName}"? It will also be removed from Google Drive.`)) return;
    setWorking(a.id);
    setNote(null);
    try {
      await deleteFromDrive(driveUrl, a.driveFileId);
      await proposalService.removeAttachment(a.id);
      onChanged();
    } catch (e: any) {
      setNote(e?.message || 'Could not delete.');
    } finally {
      setWorking(null);
    }
  };

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', border: '1px solid var(--line)', borderRadius: '6px', background: '#FAF8F5', fontSize: '12.5px' };

  return (
    <div className="form-field">
      <label>Attachments</label>
      <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)' }}>TOR, tender notice, PDF, image, doc … up to 100 MB each. Saved in Google Drive.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {saved.map(a => (
          <div key={a.id} style={row}>
            <FileText size={14} color="var(--navy)" />
            <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{a.fileName}</span>
            <span style={{ color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>{fmtSize(a.size)}</span>
            <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '3px 8px' }} disabled={busy || working !== null} onClick={() => download(a)} title="Download">
              {working === a.id ? '…' : <Download size={13} />}
            </button>
            {isAdmin && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', color: '#B91C1C' }} disabled={busy || working !== null} onClick={() => remove(a)} title="Delete (Admin)">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ))}
        {queued.map((f, i) => (
          <div key={`${f.name}-${i}`} style={{ ...row, background: '#EFF6FF' }}>
            <Paperclip size={14} color="var(--navy)" />
            <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{f.name}</span>
            <span style={{ color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
              {busy && progress[i] !== undefined ? `${Math.round(progress[i] * 100)}%` : `${fmtSize(f.size)} · to upload`}
            </span>
            {!busy && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ padding: '3px 8px' }} onClick={() => onUnqueue(i)} title="Remove from the list">
                ×
              </button>
            )}
          </div>
        ))}
        {saved.length === 0 && queued.length === 0 && <div style={{ fontSize: '12.5px', color: 'var(--ink-muted)' }}>No files yet.</div>}
      </div>
      <input ref={fileRef} type="file" multiple onChange={e => pick(e.target.files)} disabled={busy} style={{ marginTop: '6px' }} />
      {note && <div style={{ fontSize: '12px', color: '#B91C1C' }}>{note}</div>}
    </div>
  );
};
