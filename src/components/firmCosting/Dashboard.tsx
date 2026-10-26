import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { ClientTotals, CostingSummary, Projection, fmtBDT, fmtShort, monthLabel } from '../../lib/firmCosting';
import { FcColorsContext, useColors } from './chartColors';
import { BudgetBars, ClientProfitBars, Donut, MiniBars, MonthlyCombo, ProjectionBars, Ring } from './charts';

export type DashSection = 'overview' | 'clients';

/** `light`: in a theme that has a light variant (Vivid) the card is light and its charts use the light colours. */
const Card: React.FC<{ title: string; sub?: string; cls: string; light?: boolean; children: React.ReactNode }> = ({ title, sub, cls, light, children }) => {
  const C = useColors();
  return (
    <div className={`fc-glass ${cls}`}>
      <div className="fc-card-title">{title}</div>
      <div className="fc-card-sub">{sub || ' '}</div>
      {light && C.light ? <FcColorsContext.Provider value={C.light}>{children}</FcColorsContext.Provider> : children}
    </div>
  );
};

type SortKey = 'clientName' | 'revenue' | 'cost' | 'profit' | 'margin' | 'budget';

interface Props {
  section: DashSection;
  summary: CostingSummary;
  projection: Projection | null;
  includeConveyance: boolean;
  /** true when one client is chosen */
  singleClient: boolean;
}

export const Dashboard: React.FC<Props> = ({ section, summary: s, projection, includeConveyance, singleClient }) => {
  const C = useColors();
  const [sortKey, setSortKey] = useState<SortKey>('revenue');
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const val = (c: ClientTotals): number | string => (sortKey === 'margin' ? (c.margin ?? -Infinity) : c[sortKey]);
    return [...s.perClient].sort((a, b) => {
      const x = val(a), y = val(b);
      const r = typeof x === 'string' ? x.localeCompare(String(y)) : (x as number) - (y as number);
      return asc ? r : -r;
    });
  }, [s.perClient, sortKey, asc]);

  const head = (k: SortKey, label: string, right = true) => (
    <th style={{ textAlign: right ? 'right' : 'left', cursor: 'pointer', userSelect: 'none' }} onClick={() => { if (sortKey === k) setAsc(!asc); else { setSortKey(k); setAsc(k === 'clientName'); } }}>
      {label}{sortKey === k && (asc ? <ArrowUp size={11} style={{ marginLeft: 3 }} /> : <ArrowDown size={11} style={{ marginLeft: 3 }} />)}
    </th>
  );

  if (s.perClient.length === 0) {
    return <div className="fc-glass fc-empty">No invoice figures for this period yet. Use “Monthly Entry” to add them.</div>;
  }

  const monthCount = Math.max(s.months.length, 1);
  const profitColor = s.profit < 0 ? C.loss : C.gain;
  const budgetPct = s.budget > 0 ? (s.revenue / s.budget) * 100 : null;
  const lossClients = s.perClient.filter(c => c.profit < 0);
  const top = s.perClient[0];
  const top3 = s.perClient.slice(0, 3).reduce((t, c) => t + c.revenue, 0);
  const best = [...s.perClient].sort((a, b) => b.profit - a.profit)[0];
  const worst = [...s.perClient].sort((a, b) => a.profit - b.profit)[0];
  const billedCost = s.perClient.reduce((t, c) => t + c.cost, 0);
  const revenueSlices = s.perClient.map(c => ({ label: c.clientName, value: c.revenue }));
  const costSlices = s.costByClient.map(c => ({ label: c.clientName, value: c.cost }));

  if (section === 'overview') {
    return (
      <>
        <div className="fc-grid">
          <div className="fc-glass fc-c4 fc-t1">
            <div className="fc-hero-label">
              {s.profit < 0 ? 'Net loss' : 'Net profit'}
              {s.margin !== null && <span className={`fc-chip ${s.profit < 0 ? 'down' : 'up'}`}>{s.margin.toFixed(1)}% margin</span>}
            </div>
            <div className="fc-hero-value" style={{ color: profitColor }}>{s.profit < 0 ? '−' : ''}{fmtBDT(Math.abs(s.profit))}</div>
            <MiniBars values={s.perMonth.map(m => m.profit)} />
            <div className="fc-hero-rows">
              <div><b>{fmtShort(s.revenue)}</b><span>Net revenue</span></div>
              <div><b>{fmtShort(s.cost)}</b><span>Total cost</span></div>
              <div><b>{fmtShort(s.gross)}</b><span>Invoiced</span></div>
            </div>
          </div>

          <div className="fc-tiles fc-c4">
            <div className="fc-glass fc-tile teal fc-t4">
              <span className="fc-tile-label">Net revenue</span>
              <span className="fc-tile-value">{fmtShort(s.revenue)}</span>
              <span className="fc-tile-note">After VAT &amp; tax</span>
            </div>
            <div className="fc-glass fc-tile fc-t2">
              <span className="fc-tile-label">{includeConveyance ? 'Cost + conveyance' : 'Cost (salary)'}</span>
              <span className="fc-tile-value" style={{ color: C.cost }}>{fmtShort(s.cost)}</span>
              <span className="fc-tile-note">{s.headcount} people</span>
            </div>
            <div className="fc-glass fc-tile fc-t5" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span className="fc-tile-label">Budget achieved</span>
                <span className="fc-tile-note">{budgetPct === null ? 'No budget entered' : `${fmtShort(s.revenue)} of ${fmtShort(s.budget)}`}</span>
              </div>
              {budgetPct !== null && <div style={{ marginLeft: 'auto' }}><Ring pct={budgetPct} label="Budget achieved" /></div>}
            </div>
            <div className="fc-glass fc-tile fc-t6">
              <span className="fc-tile-label">Avg monthly {s.profit < 0 ? 'loss' : 'profit'}</span>
              <span className="fc-tile-value" style={{ color: profitColor }}>{fmtShort(s.profit / monthCount)}</span>
              <span className="fc-tile-note">over {s.months.length} month{s.months.length === 1 ? '' : 's'}</span>
            </div>
          </div>

          <Card title="Top revenue" sub="By net revenue, with profit or loss" cls="fc-c4 fc-t9">
            {s.perClient.slice(0, 6).map(c => (
              <div key={c.clientId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 12.5, borderBottom: '1px solid var(--fc-line)' }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={c.clientName}>{c.clientName}</span>
                <span style={{ color: 'var(--ink-soft)' }}>{fmtShort(c.revenue)}</span>
                <span style={{ minWidth: 62, textAlign: 'right', fontWeight: 700, color: c.profit < 0 ? C.loss : C.gain }}>{fmtShort(c.profit)}</span>
              </div>
            ))}
          </Card>
        </div>

        <div className="fc-grid">
          <Card title="Revenue, cost and profit / loss by month" sub="Net revenue, cost, and profit (green) or loss (red) for each month" cls="fc-c12 fc-t7" light>
            <MonthlyCombo data={s.perMonth} />
            <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: 'var(--ink-soft)' }}>
              <span><i style={{ display: 'inline-block', width: 10, height: 10, background: (C.light || C).revenue, marginRight: 5, borderRadius: 2 }} />Net revenue</span>
              <span><i style={{ display: 'inline-block', width: 10, height: 10, background: (C.light || C).cost, marginRight: 5, borderRadius: 2 }} />Cost</span>
              <span><i style={{ display: 'inline-block', width: 10, height: 10, background: (C.light || C).gain, marginRight: 5, borderRadius: 2 }} />Profit</span>
              <span><i style={{ display: 'inline-block', width: 10, height: 10, background: (C.light || C).loss, marginRight: 5, borderRadius: 2 }} />Loss</span>
            </div>
          </Card>
        </div>
        {!singleClient && (
          <div className="fc-grid fc-split-40-60">
            <Card title="Revenue share" sub="Net revenue by client" cls="fc-t1 fc-flex">
              <div className="fc-body">
                <Donut slices={revenueSlices} centerLabel="Net revenue" />
                <div>
                  <div className="fc-card-title" style={{ fontSize: 12.5, marginBottom: 2 }}>Projected revenue, next 3 months</div>
                  {projection && projection.recurringClients > 0 ? (
                    <>
                      <div className="fc-card-sub" style={{ margin: '0 0 8px' }}>
                        {projection.recurringClients} recurring client{projection.recurringClients === 1 ? '' : 's'} billing what they billed in {monthLabel(projection.lastMonth, false)}. One-time clients are left out.
                      </div>
                      <div className="stat-pills fc-proj-pills">
                        <div className="stat-pill navy-border">
                          <span className="stat-pill-label">Projected net revenue</span>
                          <span className="stat-pill-value" style={{ color: 'var(--navy, #1B2A6B)' }}>{fmtBDT(projection.totalRevenue)}</span>
                        </div>
                        <div className="stat-pill" style={{ borderColor: projection.totalProfit < 0 ? '#C0392B' : '#2E8B57' }}>
                          <span className="stat-pill-label">Projected {projection.totalProfit < 0 ? 'loss' : 'profit'}</span>
                          <span className="stat-pill-value" style={{ color: projection.totalProfit < 0 ? '#C0392B' : '#2E8B57' }}>{projection.totalProfit < 0 ? '−' : ''}{fmtBDT(Math.abs(projection.totalProfit))}</span>
                        </div>
                        <div className="stat-pill teal-border">
                          <span className="stat-pill-label">Per month</span>
                          <span className="stat-pill-value" style={{ color: 'var(--teal-dark, #156E6E)' }}>{fmtBDT(projection.monthlyRevenue)}</span>
                        </div>
                      </div>
                      <ProjectionBars data={[
                        ...projection.history.map(h => ({ label: monthLabel(h.month), value: h.revenue, projected: false })),
                        ...projection.future.map(f => ({ label: monthLabel(f.month), value: f.revenue, projected: true }))
                      ]} />
                    </>
                  ) : (
                    <div className="fc-card-sub">No recurring clients with recent invoices to project from.</div>
                  )}
                </div>
              </div>
            </Card>
            <Card title="Cost by client" sub={includeConveyance ? 'Manpower salary and conveyance, all clients' : 'Manpower salary only, all clients'} cls="fc-t9">
              <Donut slices={costSlices} centerLabel="Total cost" size={340} />
            </Card>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <div className="fc-grid">
        <Card title="Profit and loss by client" sub={s.perClient.length > 12 ? 'Top 6 and bottom 6 shown' : undefined} cls="fc-c6 fc-t9">
          <ClientProfitBars clients={s.perClient} />
        </Card>
        <Card title="Budget against actual" sub="Grey = budget, coloured = actual net revenue (green once met)" cls="fc-c6 fc-t7" light>
          <BudgetBars clients={s.perClient} />
        </Card>
      </div>
      <div className="fc-grid">
        {!singleClient && (
          <Card title="Management view" cls="fc-c12 fc-t7">
            <ul className="fc-notes">
              <li><b>{top.clientName}</b> is the biggest client: {s.revenue > 0 ? ((top.revenue / s.revenue) * 100).toFixed(1) : 0}% of net revenue. The top 3 clients bring {s.revenue > 0 ? ((top3 / s.revenue) * 100).toFixed(1) : 0}%.</li>
              <li>Best result: <b>{best.clientName}</b> ({fmtBDT(best.profit)}). Weakest: <b>{worst.clientName}</b> ({fmtBDT(worst.profit)}).</li>
              <li>{lossClients.length === 0 ? 'No client is loss-making in this period.' : `${lossClients.length} of ${s.perClient.length} clients are loss-making: ${lossClients.slice(0, 5).map(c => c.clientName).join(', ')}${lossClients.length > 5 ? '…' : ''}.`}</li>
              {s.unallocatedCost > 0 && <li>{fmtBDT(s.unallocatedCost)} of cost is not on any billed client (people with no client, or clients not billed that month). It lowers firm profit but is in no client’s line.</li>}
              <li>Cost uses today’s manpower salary table for every month shown; past salary changes are not tracked.</li>
            </ul>
          </Card>
        )}
      </div>
      <div className="fc-glass fc-t9" style={{ marginBottom: 12, padding: 8 }}>
        <div className="table-responsive">
          <table className="data-table" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                {head('clientName', 'Client', false)}
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Months</th>
                {head('revenue', 'Net revenue')}
                {head('cost', 'Cost')}
                {head('profit', 'Profit / loss')}
                {head('margin', 'Margin')}
                {head('budget', 'Budget')}
                <th style={{ textAlign: 'right' }}>vs budget</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map(c => (
                <tr key={c.clientId}>
                  <td style={{ fontWeight: 600 }}>{c.clientName}</td>
                  <td>{c.engagement === 'ONE_TIME' ? 'One-time' : 'Recurring'}</td>
                  <td style={{ textAlign: 'right' }}>{c.months.length}</td>
                  <td style={{ textAlign: 'right' }}>{fmtBDT(c.revenue)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtBDT(c.cost)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: c.profit < 0 ? C.loss : C.gain }}>{c.profit < 0 ? '−' : ''}{fmtBDT(Math.abs(c.profit))}</td>
                  <td style={{ textAlign: 'right' }}>{c.margin === null ? '—' : `${c.margin.toFixed(1)}%`}</td>
                  <td style={{ textAlign: 'right' }}>{c.budget ? fmtBDT(c.budget) : '—'}</td>
                  <td style={{ textAlign: 'right', color: c.budget && c.revenue < c.budget ? C.loss : undefined }}>{c.budget ? `${((c.revenue / c.budget) * 100).toFixed(0)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ fontWeight: 700 }}>
                <td colSpan={3}>{singleClient ? 'Total' : 'Billed clients'}</td>
                <td style={{ textAlign: 'right' }}>{fmtBDT(s.revenue)}</td>
                <td style={{ textAlign: 'right' }}>{fmtBDT(billedCost)}</td>
                <td style={{ textAlign: 'right' }}>{fmtBDT(s.revenue - billedCost)}</td>
                <td /><td style={{ textAlign: 'right' }}>{s.budget ? fmtBDT(s.budget) : '—'}</td><td />
              </tr>
              {s.unallocatedCost > 0 && (
                <tr>
                  <td colSpan={4}>Unallocated cost (no client / not billed that month)</td>
                  <td style={{ textAlign: 'right' }}>{fmtBDT(s.unallocatedCost)}</td>
                  <td colSpan={4} />
                </tr>
              )}
              {!singleClient && (
                <tr style={{ fontWeight: 700 }}>
                  <td colSpan={3}>Firm total</td>
                  <td style={{ textAlign: 'right' }}>{fmtBDT(s.revenue)}</td>
                  <td style={{ textAlign: 'right' }}>{fmtBDT(s.cost)}</td>
                  <td style={{ textAlign: 'right', color: s.profit < 0 ? C.loss : C.gain }}>{s.profit < 0 ? '−' : ''}{fmtBDT(Math.abs(s.profit))}</td>
                  <td style={{ textAlign: 'right' }}>{s.margin === null ? '—' : `${s.margin.toFixed(1)}%`}</td>
                  <td colSpan={2} />
                </tr>
              )}
            </tfoot>
          </table>
        </div>
      </div>
    </>
  );
};
