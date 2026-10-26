import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, Check, Download, Palette, PencilLine, Users } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { FcColorsContext, FcTheme, THEMES, THEME_COLORS, isFcTheme } from './chartColors';
import { ClientCost, clientNameOf, currentMonth, loadClientCosts, monthLabel, monthRange, projectRevenue, summarize } from '../../lib/firmCosting';
import { firmCostingService } from '../../services/firmCostingService';
import { FirmCostingRow } from '../../types';
import { DashSection, Dashboard } from './Dashboard';
import './firmCosting.css';
import { MonthlyEntry } from './MonthlyEntry';

export const FirmCosting: React.FC = () => {
  const { allClients, currentUser } = useAuth();
  const isAdmin = currentUser?.role === 'ADMIN';
  const [theme, setThemeState] = useState<FcTheme>('glass');
  const [themeOpen, setThemeOpen] = useState(false);
  const [themeError, setThemeError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [rows, setRows] = useState<FirmCostingRow[]>([]);
  const [costs, setCosts] = useState<Map<string, ClientCost>>(new Map());
  const [costError, setCostError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [view, setView] = useState<DashSection | 'entry'>('overview');
  const [includeConveyance, setIncludeConveyance] = useState(true);
  const [fromMonth, setFromMonth] = useState('');
  const [toMonth, setToMonth] = useState('');
  const [clientId, setClientId] = useState('');

  const reload = useCallback(async () => {
    setRows(await firmCostingService.list());
  }, []);

  // the look Admin chose (everyone sees it); stays on Glass until one is saved
  useEffect(() => {
    let on = true;
    firmCostingService.getTheme().then(t => { const v = t === 'vivid' ? 'glass' : t; if (on && isFcTheme(v)) setThemeState(v); }).catch(() => {});
    return () => { on = false; };
  }, []);

  const chooseTheme = async (t: FcTheme) => {
    const before = theme;
    setThemeState(t);
    setThemeOpen(false);
    setThemeError(null);
    try {
      await firmCostingService.setTheme(t);
    } catch (e: any) {
      setThemeState(before);
      setThemeError(e?.message || 'Could not save the theme.');
    }
  };

  useEffect(() => {
    let on = true;
    Promise.all([
      firmCostingService.list(),
      loadClientCosts().catch((e: any) => { if (on) setCostError(e?.message || 'Could not load manpower cost.'); return new Map<string, ClientCost>(); })
    ])
      .then(([r, c]) => { if (on) { setRows(r); setCosts(c); setLoading(false); } })
      .catch((e: any) => { if (on) { setError(e?.message || 'Could not load Firm Costing.'); setLoading(false); } });
    return () => { on = false; };
  }, []);

  const dataMonths = useMemo(() => Array.from(new Set(rows.map(r => r.month))).sort(), [rows]);
  const lastData = dataMonths[dataMonths.length - 1] || '';
  // Default: the current month only (the newest month with figures when this month has none yet); widen From / To for more
  const defaultMonth = dataMonths.includes(currentMonth()) ? currentMonth() : lastData;
  const from = fromMonth || defaultMonth;
  const toRaw = toMonth || defaultMonth;
  // a From later than To would leave an empty range: the range then starts and ends on From
  const to = from && toRaw < from ? from : toRaw;

  const months = useMemo(() => (from && to && from <= to ? monthRange(from, to) : []), [from, to]);
  const clientOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach(r => m.set(r.clientId, r.clientName));
    return Array.from(m, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const summary = useMemo(() => summarize(rows, costs, includeConveyance, months, clientId, id => clientNameOf(allClients, id, id)), [rows, costs, includeConveyance, months, clientId, allClients]);

  const projection = useMemo(() => projectRevenue(rows, costs, includeConveyance, clientId), [rows, costs, includeConveyance, clientId]);

  const exportExcel = async () => {
    setExportError(null);
    try {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Client-wise');
    ws.addRow([`Firm costing ${monthLabel(from, false)} to ${monthLabel(to, false)} (${includeConveyance ? 'with' : 'without'} conveyance)`]).font = { bold: true, size: 13 };
    ws.addRow([]);
    ws.addRow(['Client', 'Type', 'Months', 'Invoice value (incl. VAT & tax)', 'Net revenue', 'Cost', 'Profit / loss', 'Margin %', 'Budget']).font = { bold: true };
    summary.perClient.forEach(c => ws.addRow([c.clientName, c.engagement === 'ONE_TIME' ? 'One-time' : 'Recurring', c.months.length, c.gross, c.revenue, c.cost, c.profit, c.margin === null ? '' : Number(c.margin.toFixed(1)), c.budget]));
    if (summary.unallocatedCost > 0) ws.addRow(['Unallocated cost', '', '', '', '', summary.unallocatedCost]);
    ws.addRow(['Firm total', '', '', summary.gross, summary.revenue, summary.cost, summary.profit, summary.margin === null ? '' : Number(summary.margin.toFixed(1)), summary.budget]).font = { bold: true };
    const ms = wb.addWorksheet('Month-wise');
    ms.addRow(['Month', 'Invoice value (incl. VAT & tax)', 'Net revenue', 'Cost', 'Profit / loss', 'Budget']).font = { bold: true };
    summary.perMonth.forEach(m => ms.addRow([monthLabel(m.month, false), m.gross, m.revenue, m.cost, m.profit, m.budget]));
    [ws, ms].forEach(sheet => { sheet.columns.forEach((col, i) => { col.width = i === 0 ? 34 : 18; }); });
    const buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `Firm-Costing-${from}-to-${to}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    } catch (e: any) {
      setExportError(e?.message || 'Could not create the Excel file.');
    }
  };

  if (loading) return <div className="tab-pane"><div className="loading-indicator">Loading Firm Costing…</div></div>;
  if (error) return <div className="tab-pane"><div className="auth-alert-error">{error}</div></div>;

  const tab = (k: DashSection | 'entry', icon: React.ReactNode, label: string) => (
    <button className={view === k ? 'on' : ''} onClick={() => setView(k)}>{icon}{label}</button>
  );

  return (
    <div className="tab-pane">
      <FcColorsContext.Provider value={THEME_COLORS[theme]}>
      <div className="fc-stage" data-theme={theme}>
        <div className="fc-glass fc-top fc-t7">
          <div className="fc-title">Firm Costing<small>{view === 'entry' ? 'Enter client-wise invoice values' : `${monthLabel(from, false)} – ${monthLabel(to, false)}`}</small></div>
          {view !== 'entry' && (
            <>
              <label className="fc-field"><span>From</span>
                <select value={from} onChange={e => setFromMonth(e.target.value)}>
                  {dataMonths.map(m => <option key={m} value={m}>{monthLabel(m, false)}</option>)}
                </select>
              </label>
              <label className="fc-field"><span>To</span>
                <select value={to} onChange={e => setToMonth(e.target.value)}>
                  {dataMonths.map(m => <option key={m} value={m}>{monthLabel(m, false)}</option>)}
                </select>
              </label>
              <label className="fc-field wide"><span>Client</span>
                <select value={clientId} onChange={e => setClientId(e.target.value)}>
                  <option value="">All clients</option>
                  {clientOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
                            <label className="fc-switch" title="On: conveyance is counted in the cost. Off: salary only">
                <input type="checkbox" checked={includeConveyance} onChange={e => setIncludeConveyance(e.target.checked)} />
                <i /> Include conveyance
              </label>
              <button className="fc-pill-btn" onClick={exportExcel} disabled={summary.perClient.length === 0}><Download size={14} /> Excel</button>
            </>
          )}
        </div>

        {exportError && <div className="auth-alert-error" style={{ marginBottom: 12 }}>{exportError}</div>}
        {themeError && <div className="auth-alert-error" style={{ marginBottom: 12 }}>{themeError}</div>}
        {costError && <div className="auth-alert-error" style={{ marginBottom: 12 }}>Manpower cost could not be loaded, so cost shows as 0. {costError}</div>}

        {view === 'entry'
          ? <MonthlyEntry rows={rows} clients={allClients} onSaved={reload} />
          : <Dashboard section={view} summary={summary} projection={projection} includeConveyance={includeConveyance} singleClient={Boolean(clientId)} />}

        <div className="fc-dock-wrap">
          <div className="fc-glass fc-dock fc-t7">
            {tab('overview', <BarChart3 size={15} />, 'Overview')}
            {tab('clients', <Users size={15} />, 'Clients')}
            {tab('entry', <PencilLine size={15} />, 'Monthly Entry')}
            {isAdmin && (
              <>
                <span className="fc-sep" />
                <span className="fc-theme-wrap">
                  <button className={themeOpen ? 'on' : ''} onClick={() => setThemeOpen(o => !o)} title="Change the look of Firm Costing for everyone (Admin only)">
                    <Palette size={15} />Theme
                  </button>
                  {themeOpen && (
                    <div className="fc-theme-menu">
                      <div className="head">Theme (everyone sees it)</div>
                      {THEMES.map(t => (
                        <button key={t.id} className={theme === t.id ? 'on' : ''} onClick={() => chooseTheme(t.id)}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{theme === t.id && <Check size={13} />}{t.label}</span>
                          <small>{t.note}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </span>
              </>
            )}
          </div>
        </div>
      </div>
      </FcColorsContext.Provider>
    </div>
  );
};
