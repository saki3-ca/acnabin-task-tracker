import React, { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { parseCsv, normalizeStaffSheet, StaffRow } from '../../lib/staffSheet';
import { staffService } from '../../services/staffService';
import { StaffImportResult, StaffImportRowResult } from '../../types';

const BATCH = 400; // the database accepts up to 500 rows per call

const STATUS_COLOR: Record<string, string> = {
  NEW: '#166534',
  UPDATED: '#1D4ED8',
  UNCHANGED: '#64748B',
  ERROR: '#B91C1C'
};

const merge = (parts: StaffImportResult[]): StaffImportResult => {
  const out: StaffImportResult = { status: 'OK', new: 0, updated: 0, unchanged: 0, linked: 0, errors: 0, total: 0, rows: [] };
  parts.forEach(p => {
    out.new! += p.new || 0;
    out.updated! += p.updated || 0;
    out.unchanged! += p.unchanged || 0;
    out.linked! += p.linked || 0;
    out.errors! += p.errors || 0;
    out.total! += p.total || 0;
    out.rows!.push(...(p.rows || []));
  });
  return out;
};

export const StaffImport: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [mode, setMode] = useState<'FILL' | 'OVERWRITE'>('FILL');
  const [preview, setPreview] = useState<StaffImportResult | null>(null);
  const [done, setDone] = useState<StaffImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (dryRun: boolean): Promise<StaffImportResult> => {
    const parts: StaffImportResult[] = [];
    for (let i = 0; i < rows.length; i += BATCH) {
      const res = await staffService.importStaff(rows.slice(i, i + BATCH), mode, dryRun);
      if (res.status !== 'OK') {
        throw new Error(
          res.status === 'FORBIDDEN' ? 'Only an Admin can import the staff sheet.' : 'Your session has expired. Please sign in again.'
        );
      }
      parts.push(res);
    }
    return merge(parts);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setPreview(null);
    setDone(null);
    try {
      const text = await file.text();
      const { rows: parsed, warnings: warns } = normalizeStaffSheet(parseCsv(text));
      if (parsed.length === 0) throw new Error('No staff rows found. Please check that the file is the staff sheet exported as CSV.');
      setRows(parsed);
      setWarnings(warns);
      setFileName(file.name);
    } catch (e: any) {
      setRows([]);
      setWarnings([]);
      setFileName('');
      setError(e?.message || 'Could not read that file.');
    }
  };

  const doPreview = async () => {
    setBusy(true);
    setError(null);
    setDone(null);
    try {
      setPreview(await run(true));
    } catch (e: any) {
      setError(e?.message || 'Preview failed.');
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    setError(null);
    try {
      setDone(await run(false));
      setPreview(null);
      setRows([]);
      setFileName('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (e: any) {
      setError(e?.message || 'Import failed.');
    } finally {
      setBusy(false);
    }
  };

  const shown: StaffImportRowResult[] = (preview?.rows || []).filter(r => r.status !== 'UNCHANGED');
  const summary = (r: StaffImportResult) =>
    `${r.total} rows: ${r.new} new, ${r.updated} updated, ${r.unchanged} unchanged, ${r.errors} errors. ${r.linked} linked to existing accounts.`;

  return (
    <div className="table-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--navy)' }}>
        <FileUp size={18} /> Import Staff Sheet
      </h3>
      <p style={{ fontSize: '12px', color: 'var(--ink-soft)', marginTop: '4px', marginBottom: '14px' }}>
        Upload the staff sheet (File → Download → CSV). Each person is matched by STD / EMP ID. Blank cells never erase saved data.
        Always run the preview first: nothing is saved until you press Import.
      </p>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={e => onFile(e.target.files?.[0])} disabled={busy} />
        <select className="form-select" value={mode} onChange={e => { setMode(e.target.value as 'FILL' | 'OVERWRITE'); setPreview(null); }} style={{ maxWidth: '360px' }} disabled={busy}>
          <option value="FILL">Fill blanks only (keep what people already saved)</option>
          <option value="OVERWRITE">Overwrite with the sheet (non-blank sheet values win)</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={doPreview} disabled={busy || rows.length === 0}>
          {busy && !preview ? 'Checking…' : 'Preview'}
        </button>
        {preview && preview.errors !== preview.total && (
          <button className="btn btn-primary btn-sm" onClick={doImport} disabled={busy}>
            {busy ? 'Importing…' : 'Import now'}
          </button>
        )}
      </div>

      {fileName && <div style={{ fontSize: '12px', color: 'var(--ink-soft)' }}>{fileName}: {rows.length} staff rows read.</div>}
      {error && <div className="auth-alert-error" style={{ marginTop: '10px' }}>{error}</div>}
      {done && (
        <div style={{ marginTop: '10px', fontSize: '12.5px', color: '#166534', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '8px 10px' }}>
          Import finished. {summary(done)}
        </div>
      )}

      {warnings.length > 0 && (
        <details style={{ marginTop: '10px', fontSize: '12px' }}>
          <summary style={{ cursor: 'pointer', color: '#B45309' }}>{warnings.length} things to check in the sheet</summary>
          <ul style={{ margin: '6px 0 0 18px' }}>
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </details>
      )}

      {preview && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '12.5px', fontWeight: 600, marginBottom: '6px' }}>Preview: {summary(preview)}</div>
          <div style={{ maxHeight: '320px', overflow: 'auto', border: '1px solid var(--line)', borderRadius: '6px' }}>
            <table className="data-table">
              <thead>
                <tr><th>ID</th><th>Name</th><th>Result</th><th>Account</th><th>Changes / problem</th></tr>
              </thead>
              <tbody>
                {shown.map(r => (
                  <tr key={r.emp_id}>
                    <td>{r.emp_id}</td>
                    <td>{r.name}{r.nameMismatch && <span title="The account name is different from the sheet name" style={{ color: '#B45309' }}> ⚠ name differs</span>}</td>
                    <td style={{ color: STATUS_COLOR[r.status], fontWeight: 600 }}>{r.status}</td>
                    <td>{r.linked ? 'Linked' : r.account ? 'Not linked' : 'No account yet'}</td>
                    <td style={{ fontSize: '11.5px' }}>{r.error || (r.changed || []).join(', ')}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center' }}>Nothing would change.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
