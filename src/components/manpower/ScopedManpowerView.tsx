import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Building, Download, Filter, RotateCcw, Search, Users } from 'lucide-react';
import { academicYearFromStart, employmentYearFromJoining, isEmployeeProfile, principalDisplay } from '../../lib/academicYear';
import { downloadScopedManpowerExcel } from '../../lib/manpowerScopedExcel';
import { isStudentLevelDesignation } from '../../lib/permissions';
import { formatPeriodDate } from '../../lib/staffSheet';
import { clientText } from '../ui/ClientLabel';
import { ScopedManpower, ScopedManpowerRow } from '../../types';

/** Manpower tab for In Charge to Manager (below Assistant Director): only the people on their own clients, no money. */
interface Props {
  data: ScopedManpower;
}

interface Row extends ScopedManpowerRow {
  year: string;
  clientsText: string;
}

type Col = { key: string; label: string; width: number; get: (r: Row) => string; center?: boolean; sort?: (r: Row) => string };

const COLS: Col[] = [
  { key: 'empId', label: 'STD/EMP ID', width: 110, get: r => r.empId, center: true },
  { key: 'name', label: 'Name', width: 180, get: r => r.name },
  { key: 'designation', label: 'Designation', width: 150, get: r => r.designation, center: true },
  { key: 'department', label: 'Department', width: 120, get: r => r.department },
  { key: 'clientsText', label: 'Client Name(s)', width: 230, get: r => r.clientsText },
  { key: 'year', label: 'Academic / Employment Year', width: 150, get: r => r.year, center: true },
  { key: 'joiningDate', label: 'Joining Date', width: 105, get: r => formatPeriodDate(r.joiningDate) || r.joiningDate, sort: r => r.joiningDate, center: true },
  // two lines: "29 Sep 2022 to" then "28 Sep 2026"
  { key: 'articleshipPeriod', label: 'Articleship Period', width: 140, get: r => r.articleshipPeriod.replace(/\s+to\s+/i, ' to\n'), center: true },
  { key: 'articleshipStart', label: 'Articleship Start', width: 110, get: r => formatPeriodDate(r.articleshipStart) || r.articleshipStart, sort: r => r.articleshipStart, center: true },
  { key: 'articleshipEnd', label: 'Articleship End', width: 110, get: r => formatPeriodDate(r.articleshipEnd) || r.articleshipEnd, sort: r => r.articleshipEnd, center: true },
  { key: 'principalName', label: 'Principal', width: 190, get: r => principalDisplay(r.principalName) },
  { key: 'mobile', label: 'Mobile', width: 120, get: r => r.mobile },
  { key: 'email', label: 'Email', width: 220, get: r => r.email },
  { key: 'bloodGroup', label: 'Blood Group', width: 85, get: r => r.bloodGroup, center: true },
  { key: 'presentAddress', label: 'Present Address', width: 240, get: r => r.presentAddress },
  { key: 'emergencyName', label: 'Emergency Contact Name', width: 170, get: r => r.emergencyName },
  { key: 'emergencyRelationship', label: 'Relationship', width: 110, get: r => r.emergencyRelationship },
  { key: 'emergencyPhone', label: 'Emergency Mobile', width: 125, get: r => r.emergencyPhone },
  { key: 'laptopAvailable', label: 'Laptop Available', width: 95, get: r => r.laptopAvailable, center: true },
  { key: 'laptopOwnership', label: 'Laptop Ownership', width: 115, get: r => r.laptopOwnership, center: true },
  { key: 'laptopId', label: 'Laptop ID', width: 110, get: r => r.laptopId },
  { key: 'remarks', label: 'Remarks', width: 220, get: r => r.remarks }
];

const SL_W = 44;
const ID_W = COLS[0].width;
const stickyLeft = (i: number): React.CSSProperties | undefined =>
  i === 0 ? { position: 'sticky', left: SL_W, zIndex: 2, background: '#fff' }
  : i === 1 ? { position: 'sticky', left: SL_W + ID_W, zIndex: 2, background: '#fff', boxShadow: '2px 0 0 var(--line)' }
  : undefined;

export const ScopedManpowerView: React.FC<Props> = ({ data }) => {
  const [viewMode, setViewMode] = useState<'details' | 'summary'>('details');
  const [search, setSearch] = useState('');
  // One client assigned: show its name by default; several: start with all of them
  const onlyClient = data.clients.length === 1 ? data.clients[0].id : '';
  const [client, setClient] = useState(onlyClient);
  const [designation, setDesignation] = useState('');
  const [sortKey, setSortKey] = useState('empId');
  const [sortAsc, setSortAsc] = useState(true);

  const clientById = useMemo(() => new Map(data.clients.map(c => [c.id, c])), [data.clients]);

  const rows: Row[] = useMemo(() => data.rows.map(r => {
    const year = isEmployeeProfile(r.empId, r.designation)
      ? employmentYearFromJoining(r.joiningDate)
      : academicYearFromStart(r.articleshipStart, r.articleshipEnd);
    const clientsText = r.clientIds
      .map(id => { const c = clientById.get(id); return c ? clientText(c.name, c.jobNumber) : ''; })
      .filter(Boolean).join(', ');
    return { ...r, year: year || r.academicYear, clientsText };
  }), [data.rows, clientById]);

  const designations = useMemo(() => Array.from(new Set(rows.map(r => r.designation).filter(Boolean))).sort(), [rows]);

  const shown = useMemo(() => {
    const term = search.toLowerCase().trim();
    const list = rows.filter(r => {
      if (client && !r.clientIds.includes(client)) return false;
      if (designation && r.designation !== designation) return false;
      if (!term) return true;
      return [r.name, r.empId, r.clientsText, r.designation, r.department, r.mobile, r.email].some(v => (v || '').toLowerCase().includes(term));
    });
    const col = COLS.find(c => c.key === sortKey) || COLS[0];
    list.sort((a, b) => {
      const x = (col.sort || col.get)(a).toLowerCase();
      const y = (col.sort || col.get)(b).toLowerCase();
      return sortAsc ? x.localeCompare(y, undefined, { numeric: true }) : y.localeCompare(x, undefined, { numeric: true });
    });
    return list;
  }, [rows, search, client, designation, sortKey, sortAsc]);

  const students = shown.filter(r => isStudentLevelDesignation(r.designation)).length;
  const clientCount = client ? 1 : data.clients.length;

  const summary = useMemo(() => data.clients
    .filter(c => !client || c.id === client)
    .map(c => ({ ...c, count: rows.filter(r => r.clientIds.includes(c.id)).length })), [data.clients, rows, client]);

  const sortBy = (key: string) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(true); }
  };

  const hasFilters = Boolean(search || client !== onlyClient || designation);
  const reset = () => { setSearch(''); setClient(onlyClient); setDesignation(''); };

  const exportExcel = async () => {
    try {
      await downloadScopedManpowerExcel(shown.map(r => ({
        empId: r.empId, name: r.name, designation: r.designation, department: r.department, clients: r.clientsText, year: r.year,
        joiningDate: formatPeriodDate(r.joiningDate) || r.joiningDate, articleshipPeriod: r.articleshipPeriod.replace(/\s+to\s+/i, ' to\n'),
        articleshipStart: formatPeriodDate(r.articleshipStart) || r.articleshipStart, articleshipEnd: formatPeriodDate(r.articleshipEnd) || r.articleshipEnd, principal: r.principalName, mobile: r.mobile, email: r.email, bloodGroup: r.bloodGroup,
        presentAddress: r.presentAddress, emergencyName: r.emergencyName, relationship: r.emergencyRelationship,
        emergencyPhone: r.emergencyPhone, laptopAvailable: r.laptopAvailable, laptopOwnership: r.laptopOwnership,
        laptopId: r.laptopId, remarks: r.remarks
      })), `ACNABIN_Manpower_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error('Excel export failed:', e);
      window.alert('Could not create the Excel file. Please try again.');
    }
  };

  const pill = (label: string, value: number) => (
    <div className="stat-pill">
      <span className="stat-pill-label">{label}</span>
      <span className="stat-pill-value">{String(value).padStart(2, '0')}</span>
    </div>
  );
  const toggle = (mode: 'details' | 'summary', icon: React.ReactNode, text: string) => (
    <button
      type="button"
      onClick={() => setViewMode(mode)}
      style={{
        flex: 1, padding: '6px 10px', fontSize: '12px', fontWeight: 700, borderRadius: '6px', cursor: 'pointer',
        border: viewMode === mode ? '1px solid rgba(255, 255, 255, 0.35)' : '1px solid transparent',
        background: viewMode === mode ? 'linear-gradient(180deg, #8C1414 0%, #800000 60%, #680000 100%)' : 'transparent',
        color: viewMode === mode ? '#ffffff' : 'var(--ink-soft)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px'
      }}
    >
      {icon} {text}
    </button>
  );

  return (
    <div className="tab-pane">
      <div className="stat-pills">
        {pill('MANPOWER', shown.length)}
        {pill('MY CLIENTS', clientCount)}
        {pill('STUDENTS', students)}
        {pill('MANAGERS & ABOVE', shown.length - students)}
        <div className="stat-pill" style={{ padding: '6px 8px', display: 'flex', alignItems: 'stretch' }}>
          <div style={{ display: 'flex', width: '100%', background: 'rgba(244, 240, 240, 0.75)', borderRadius: '8px', padding: '3px', gap: '4px', border: '1px solid rgba(128, 0, 0, 0.14)' }}>
            {toggle('details', <Users size={13} />, 'Details')}
            {toggle('summary', <Building size={13} />, 'Summary')}
          </div>
        </div>
      </div>

      <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', background: '#fff', padding: '12px 18px', borderRadius: '8px', border: '1px solid var(--line)' }}>
        <div style={{ position: 'relative', minWidth: '220px', flex: '1 1 240px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-soft)' }} />
          <input type="text" className="form-input" style={{ paddingLeft: '32px', height: '36px', fontSize: '12.5px', width: '100%' }}
            placeholder="Search name, ID, client, mobile, email…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="form-select" style={{ height: '36px', fontSize: '12.5px', minWidth: '180px', flex: '1 1 180px' }} value={client} onChange={e => setClient(e.target.value)}>
          {!onlyClient && <option value="">All my clients</option>}
          {data.clients.map(c => <option key={c.id} value={c.id}>{clientText(c.name, c.jobNumber)}</option>)}
        </select>
        {viewMode === 'details' && (
          <select className="form-select" style={{ height: '36px', fontSize: '12.5px', minWidth: '160px', flex: '1 1 160px' }} value={designation} onChange={e => setDesignation(e.target.value)}>
            <option value="">All Designations</option>
            {designations.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        {hasFilters && (
          <button type="button" onClick={reset} className="btn btn-secondary btn-sm" style={{ height: '36px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
            <RotateCcw size={13} /> Reset
          </button>
        )}
      </div>

      {viewMode === 'details' ? (
        <div className="table-card">
          <div className="banner-strip banner-maroon" style={{ justifyContent: 'center', padding: '0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} /> <span>MANPOWER DIRECTORY</span>
            </div>
            <button
              type="button"
              onClick={exportExcel}
              style={{ position: 'absolute', right: '16px', background: 'rgba(255, 255, 255, 0.95)', color: 'var(--maroon, #800000)', border: 'none', padding: '3px 10px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              title="Export to Excel"
            >
              <Download size={12} /> Export Excel
            </button>
          </div>
          <div className="table-responsive" style={{ minHeight: '300px' }}>
            <table className="data-table maroon-table" style={{ width: 'max-content', minWidth: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: SL_W, minWidth: SL_W, textAlign: 'center', position: 'sticky', left: 0, zIndex: 3 }}>SL.</th>
                  {COLS.map((c, i) => (
                    <th
                      key={c.key}
                      onClick={() => sortBy(c.key)}
                      style={{ minWidth: c.width, width: c.width, textAlign: c.center ? 'center' : 'left', cursor: 'pointer', userSelect: 'none', ...(i < 2 ? { position: 'sticky', left: i === 0 ? SL_W : SL_W + ID_W, zIndex: 3 } : {}) }}
                      title={`Sort by ${c.label}`}
                    >
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span>{c.label}</span>
                        {sortKey === c.key ? (sortAsc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} opacity={0.5} />}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.length === 0 ? (
                  <tr>
                    <td colSpan={COLS.length + 1} className="empty-state" style={{ padding: '48px 16px', textAlign: 'center' }}>
                      <Filter size={32} style={{ color: 'var(--ink-muted)', opacity: 0.5, marginBottom: '8px' }} />
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>No manpower records found</div>
                      <div style={{ fontSize: '12px', color: 'var(--ink-muted)', marginTop: '4px' }}>
                        {data.clients.length === 0 ? 'You have no clients assigned yet. Ask Admin to assign your clients.' : 'Try clearing or changing the search and filters.'}
                      </div>
                    </td>
                  </tr>
                ) : shown.map((r, idx) => (
                  <tr key={`${r.empId}-${idx}`}>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--ink-muted)', position: 'sticky', left: 0, zIndex: 2, background: '#fff' }}>{idx + 1}</td>
                    {COLS.map((c, i) => {
                      const v = c.get(r);
                      return (
                        <td
                          key={c.key}
                          style={{
                            textAlign: c.center ? 'center' : 'left', fontSize: '12.5px', maxWidth: c.width + 120,
                            ...(c.key === 'articleshipPeriod' ? { whiteSpace: 'pre-line' } : {}),
                            ...(i === 0 ? { fontFamily: 'monospace', fontWeight: 700, color: 'var(--navy)' } : {}),
                            ...(i === 1 ? { fontWeight: 600 } : {}),
                            ...stickyLeft(i)
                          }}
                        >
                          {v || <span style={{ color: 'var(--ink-muted)' }}>-</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="table-card">
          <div className="banner-strip banner-maroon" style={{ justifyContent: 'center', padding: '0 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Building size={16} /> <span>CLIENT-WISE MANPOWER SUMMARY</span>
            </div>
          </div>
          <div className="table-responsive">
            <table className="data-table maroon-table">
              <thead>
                <tr>
                  <th style={{ width: '44px', textAlign: 'center' }}>SL.</th>
                  <th style={{ textAlign: 'left' }}>Client</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Manpower</th>
                  <th style={{ textAlign: 'left' }}>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {summary.length === 0 ? (
                  <tr><td colSpan={4} className="empty-state" style={{ padding: '32px 16px', textAlign: 'center' }}>No clients assigned to you yet.</td></tr>
                ) : summary.map((c, i) => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => { setClient(c.id); setViewMode('details'); }} title="Show this client's staff">
                    <td style={{ textAlign: 'center', fontWeight: 600, color: 'var(--ink-muted)' }}>{i + 1}</td>
                    <td style={{ fontWeight: 600 }}>{clientText(c.name, c.jobNumber)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>{c.count}</td>
                    <td style={{ fontSize: '12.5px', whiteSpace: 'pre-wrap' }}>{c.remarks || <span style={{ color: 'var(--ink-muted)' }}>-</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
