import React, { useRef, useState } from 'react';
import { DateOrder, parseProposalSheet, ParsedProposalSheet } from '../../lib/proposals';
import { proposalService } from '../../services/proposalService';
import { ProposalImportResult } from '../../types';
import { Modal } from '../ui/Modal';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onDone: () => void;
}

/** Admin only: copy the proposals from the old Google Sheet (CSV). Duplicates are never created. */
export const ProposalImport: React.FC<Props> = ({ isOpen, onClose, onDone }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedProposalSheet | null>(null);
  const [order, setOrder] = useState<DateOrder | undefined>(undefined);
  const [preview, setPreview] = useState<ProposalImportResult | null>(null);
  const [done, setDone] = useState<ProposalImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setText(''); setFileName(''); setParsed(null); setOrder(undefined); setPreview(null); setDone(null); setError(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const parse = (t: string, o?: DateOrder) => {
    const p = parseProposalSheet(t, o);
    setParsed(p);
    setPreview(null);
    return p;
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    setError(null);
    setDone(null);
    const t = await file.text();
    setText(t);
    setFileName(file.name);
    const p = parse(t);
    setOrder(p.order);
  };

  const check = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      setPreview(await proposalService.importRows(parsed.rows, true));
    } catch (e: any) {
      setError(e?.message || 'Could not check the file.');
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!parsed) return;
    setBusy(true);
    setError(null);
    try {
      const res = await proposalService.importRows(parsed.rows, false);
      setDone(res);
      setPreview(null);
      setParsed(null);
      onDone();
    } catch (e: any) {
      setError(e?.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  const summary = (r: ProposalImportResult) =>
    `${r.total} rows: ${r.added} new, ${r.skipped} already there (skipped), ${r.errors} with problems.`;

  return (
    <Modal isOpen={isOpen} onClose={() => { if (!busy) { reset(); onClose(); } }} title="Import proposals from the Google Sheet" maxWidth="720px">
      <div className="modal-body">
        <div style={{ fontSize: '12.5px', color: 'var(--ink-soft)' }}>
          In the old sheet open the <strong>Proposals</strong> tab, then <strong>File → Download → Comma-separated values (.csv)</strong>, and choose
          that file here. Proposals that already exist (same name and client) are skipped, so nothing is ever duplicated. Run the check first.
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e => void onFile(e.target.files?.[0])} disabled={busy} />

        {parsed && parsed.headerOk && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '13px' }}>
            <span>{fileName}: {parsed.rows.length} proposals read.</span>
            <label>
              Dates in the file are{' '}
              <select
                className="form-select"
                style={{ display: 'inline-block', width: 'auto' }}
                value={order || parsed.order}
                onChange={e => { const o = e.target.value as DateOrder; setOrder(o); parse(text, o); }}
              >
                <option value="DMY">day / month / year (e.g. 25/12/2026)</option>
                <option value="MDY">month / day / year (e.g. 12/25/2026)</option>
              </select>
            </label>
          </div>
        )}

        {parsed && parsed.warnings.length > 0 && (
          <details style={{ fontSize: '12px' }}>
            <summary style={{ cursor: 'pointer', color: '#B45309' }}>{parsed.warnings.length} things to check</summary>
            <ul style={{ margin: '6px 0 0 18px' }}>
              {parsed.warnings.slice(0, 50).map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </details>
        )}

        {error && <div className="auth-alert-error" style={{ margin: 0 }}>{error}</div>}
        {done && (
          <div style={{ fontSize: '13px', color: '#166534', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '8px 10px' }}>
            Import finished. {summary(done)}
          </div>
        )}

        {preview && (
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>Check: {summary(preview)}</div>
            <div style={{ maxHeight: '260px', overflow: 'auto', border: '1px solid var(--line)', borderRadius: '6px' }}>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Client</th><th>Result</th></tr></thead>
                <tbody>
                  {(preview.rows || []).map((r, i) => (
                    <tr key={i}>
                      <td style={{ textAlign: 'left' }}>{r.name}</td>
                      <td style={{ textAlign: 'left' }}>{r.client}</td>
                      <td style={{ fontWeight: 600, color: r.result === 'NEW' ? '#166534' : r.result === 'DUPLICATE' ? '#64748B' : '#B91C1C' }}>
                        {r.result === 'NEW' ? 'New' : r.result === 'DUPLICATE' ? 'Already there' : r.error || 'Problem'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      <div className="modal-footer">
        <button className="btn btn-secondary" onClick={() => { reset(); onClose(); }} disabled={busy}>Close</button>
        <button className="btn btn-secondary" onClick={check} disabled={busy || !parsed || parsed.rows.length === 0}>
          {busy && !preview ? 'Checking…' : 'Check'}
        </button>
        {preview && (preview.added || 0) > 0 && (
          <button className="btn btn-primary" onClick={run} disabled={busy}>
            {busy ? 'Importing…' : `Import ${preview.added} new`}
          </button>
        )}
      </div>
    </Modal>
  );
};
