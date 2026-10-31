import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { UserAnalytics, userAnalyticsService } from '../../services/userAnalyticsService';

const RANGES: { days: number; label: string }[] = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
  { days: 0, label: 'All time' }
];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const BAR = 'var(--navy, #1e3a5f)';
const BAR_SOFT = 'rgba(100,116,139,0.35)';

const fmtWhen = (iso: string | null) => {
  if (!iso) return 'Never';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? 'Never'
    : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtDay = (iso: string) => {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const Tile: React.FC<{ label: string; value: React.ReactNode; sub?: string }> = ({ label, value, sub }) => (
  <div className="table-card" style={{ padding: '14px 16px', flex: '1 1 160px', minWidth: '150px' }}>
    <div style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: '26px', fontWeight: 800, color: 'var(--navy)', marginTop: '4px', lineHeight: 1.15 }}>{value}</div>
    {sub && <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)', marginTop: '2px' }}>{sub}</div>}
  </div>
);

const Card: React.FC<{ title: string; hint?: string; children: React.ReactNode; flex?: string }> = ({ title, hint, children, flex }) => (
  <div className="table-card" style={{ padding: '16px 18px', flex: flex || '1 1 320px', minWidth: 0 }}>
    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--navy)' }}>{title}</div>
    {hint && <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)', marginTop: '2px' }}>{hint}</div>}
    <div style={{ marginTop: '12px' }}>{children}</div>
  </div>
);

/** Vertical bars with a native hover tooltip. */
const Bars: React.FC<{ items: { label: string; value: number; tip: string }[]; height?: number; labelEvery?: number }> = ({ items, height = 150, labelEvery = 1 }) => {
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: items.length > 40 ? '1px' : '3px', height: `${height}px` }}>
      {items.map((it, i) => (
        <div key={i} title={it.tip} style={{ flex: 1, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
          <div style={{ width: '100%', height: `${(it.value / max) * (height - 18)}px`, minHeight: it.value > 0 ? '2px' : 0, background: BAR, borderRadius: '3px 3px 0 0' }} />
          <div style={{ height: '16px', fontSize: '10px', color: 'var(--ink-muted)', whiteSpace: 'nowrap', overflow: 'visible' }}>
            {i % labelEvery === 0 ? it.label : ''}
          </div>
        </div>
      ))}
    </div>
  );
};

type SortKey = 'name' | 'logins' | 'activeDays' | 'loginsWeek' | 'actions' | 'lastLogin';

/** Admin only: who logs in, how often, and which clients each person actually works on. */
export const UserAnalyticsDashboard: React.FC = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<UserAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [client, setClient] = useState<string | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'logins', dir: -1 });
  const [openUser, setOpenUser] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await userAnalyticsService.get(days));
    } catch (e: any) {
      setData(null);
      setError(e?.message || 'Could not load user analytics.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  const userName = useMemo(() => new Map((data?.users ?? []).map(u => [u.userId, u.name])), [data]);

  // Per person: their clients, busiest first
  const clientsByUser = useMemo(() => {
    const m = new Map<string, { clientName: string; actions: number }[]>();
    (data?.userClients ?? []).forEach(r => {
      const list = m.get(r.userId) ?? [];
      list.push({ clientName: r.clientName, actions: Number(r.actions) });
      m.set(r.userId, list);
    });
    m.forEach(list => list.sort((a, b) => b.actions - a.actions));
    return m;
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const list = data.users
      .filter(u => u.status === 'ACTIVE' || Number(u.totalLogins) > 0)
      .filter(u => !q || u.name.toLowerCase().includes(q) || (u.empId || '').toLowerCase().includes(q) || (u.designation || '').toLowerCase().includes(q))
      .filter(u => !client || (clientsByUser.get(u.userId) ?? []).some(c => c.clientName === client))
      .map(u => ({
        ...u,
        logins: Number(u.logins), activeDays: Number(u.activeDays), loginsWeek: Number(u.loginsWeek), actions: Number(u.actions),
        topClient: clientsByUser.get(u.userId)?.[0]
      }));
    list.sort((a, b) => {
      const k = sort.key;
      const cmp = k === 'name' ? a.name.localeCompare(b.name)
        : k === 'lastLogin' ? (a.lastLogin ? Date.parse(a.lastLogin) : 0) - (b.lastLogin ? Date.parse(b.lastLogin) : 0)
        : (a[k] as number) - (b[k] as number);
      return cmp * sort.dir;
    });
    return list;
  }, [data, search, client, sort, clientsByUser]);

  const setSortKey = (key: SortKey) => setSort(s => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: key === 'name' ? 1 : -1 }));
  const arrow = (key: SortKey) => (sort.key === key ? (sort.dir === 1 ? ' ▲' : ' ▼') : '');

  const activeStaff = data ? data.users.filter(u => u.status === 'ACTIVE').length : 0;
  const neverLoggedIn = data ? data.users.filter(u => u.status === 'ACTIVE' && Number(u.totalLogins) === 0).length : 0;
  const topClient = data?.clients[0];
  const maxClientActions = Math.max(...(data?.clients ?? []).map(c => Number(c.actions)), 1);
  const daily = data?.daily ?? [];
  const th = (label: string, key: SortKey, right = true) => (
    <th onClick={() => setSortKey(key)} style={{ textAlign: right ? 'right' : 'left', padding: '10px 12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>{label}{arrow(key)}</th>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div className="table-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--navy)' }}>
            <BarChart3 size={18} /> User Analytics
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--ink-soft)', marginTop: '4px' }}>
            Logins per person and the clients they work on. A login is counted when someone signs in or opens the app (once per 4 hours). Counting starts from {data?.trackingSince ? fmtWhen(data.trackingSince) : 'the first login recorded'}; client activity comes from the Task Log.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select className="form-select" value={days} onChange={e => setDays(Number(e.target.value))} style={{ minWidth: '150px' }}>
            {RANGES.map(r => <option key={r.days} value={r.days}>{r.label}</option>)}
          </select>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={13} /> {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && <div className="auth-alert-error">{error}</div>}

      {data && (
        <>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <Tile label="Logins today" value={data.loginsToday} sub={`${data.activeUsersToday} different people`} />
            <Tile label="Logins this week" value={data.loginsWeek} sub={`${data.activeUsersWeek} different people (last 7 days)`} />
            <Tile label="Logins in range" value={data.logins} sub={`${data.activeUsers} of ${activeStaff} active staff`} />
            <Tile label="Never logged in" value={neverLoggedIn} sub="active staff, since tracking began" />
            <Tile label="Busiest client" value={<span style={{ fontSize: '17px' }}>{topClient?.clientName ?? '—'}</span>} sub={topClient ? `${topClient.actions} actions by ${topClient.users} people` : 'No task activity in range'} />
          </div>

          <Card title="Logins per day" hint="Hover a bar for the exact count. Dates are Bangladesh time." flex="1 1 100%">
            <Bars
              items={daily.map(d => ({ label: fmtDay(d.date), value: Number(d.logins), tip: `${fmtDay(d.date)}: ${d.logins} logins, ${d.users} people` }))}
              labelEvery={Math.max(1, Math.ceil(daily.length / 12))}
            />
          </Card>

          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <Card title="Logins by weekday">
              <Bars items={data.byWeekday.map(d => ({ label: WEEKDAYS[d.day], value: Number(d.logins), tip: `${WEEKDAYS[d.day]}: ${d.logins} logins` }))} height={130} />
            </Card>
            <Card title="Logins by hour of day">
              <Bars items={data.byHour.map(d => ({ label: String(d.hour), value: Number(d.logins), tip: `${d.hour}:00 – ${d.hour}:59: ${d.logins} logins` }))} height={130} labelEvery={3} />
            </Card>
          </div>

          <Card
            title="Most used clients"
            hint="Task actions (created or changed) per client in this range. Click a client to see who works on it."
            flex="1 1 100%"
          >
            {data.clients.length === 0 ? (
              <div style={{ color: 'var(--ink-muted)', fontSize: '13px' }}>No task activity in this range.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' }}>
                {data.clients.slice(0, 25).map(c => {
                  const active = client === c.clientName;
                  return (
                    <div
                      key={c.clientName}
                      onClick={() => setClient(active ? null : c.clientName)}
                      title={`${c.actions} actions · ${c.users} people · ${c.tasks} tasks`}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '3px 6px', borderRadius: '6px', background: active ? 'rgba(100,116,139,0.15)' : 'transparent' }}
                    >
                      <div style={{ width: '230px', flexShrink: 0, fontSize: '12.5px', fontWeight: active ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.clientName}</div>
                      <div style={{ flex: 1, background: BAR_SOFT, borderRadius: '4px', height: '14px' }}>
                        <div style={{ width: `${(Number(c.actions) / maxClientActions) * 100}%`, height: '100%', background: BAR, borderRadius: '4px' }} />
                      </div>
                      <div style={{ width: '170px', flexShrink: 0, fontSize: '12px', color: 'var(--ink-soft)', textAlign: 'right' }}>
                        <b>{c.actions}</b> actions · {c.users} {Number(c.users) === 1 ? 'person' : 'people'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="table-card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--navy)' }}>People</div>
                <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)', marginTop: '2px' }}>
                  Click a column to sort, click a person to see their clients.
                  {client && <> Showing people who worked on <b>{client}</b>. <a href="#clear" onClick={e => { e.preventDefault(); setClient(null); }}>Clear</a></>}
                </div>
              </div>
              <input className="form-input" placeholder="Search name, ID or designation" value={search} onChange={e => setSearch(e.target.value)} style={{ minWidth: '240px' }} />
            </div>
            <div className="table-responsive" style={{ marginTop: '12px' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    {th('Person', 'name', false)}
                    {th('Logins', 'logins')}
                    {th('Days active', 'activeDays')}
                    {th('Last 7 days', 'loginsWeek')}
                    {th('Task actions', 'actions')}
                    <th style={{ textAlign: 'left', padding: '10px 12px' }}>Top client</th>
                    {th('Last login', 'lastLogin')}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--ink-muted)' }}>No one matches.</td></tr>
                  ) : rows.map(u => (
                    <React.Fragment key={u.userId}>
                      <tr onClick={() => setOpenUser(openUser === u.userId ? null : u.userId)} style={{ cursor: 'pointer' }}>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: '11.5px', color: 'var(--ink-muted)' }}>{u.designation}{u.status !== 'ACTIVE' ? ' · inactive' : ''}</div>
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700 }}>{u.logins}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right' }}>{u.activeDays}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right' }}>{u.loginsWeek}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right' }}>{u.actions}</td>
                        <td style={{ padding: '9px 12px' }}>{u.topClient ? `${u.topClient.clientName} (${u.topClient.actions})` : '—'}</td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtWhen(u.lastLogin)}</td>
                      </tr>
                      {openUser === u.userId && (
                        <tr>
                          <td colSpan={7} style={{ padding: '8px 12px 14px 28px', background: 'rgba(100,116,139,0.07)' }}>
                            {(clientsByUser.get(u.userId) ?? []).length === 0 ? (
                              <span style={{ color: 'var(--ink-muted)', fontSize: '12.5px' }}>No task activity by {userName.get(u.userId) ?? 'this person'} in this range.</span>
                            ) : (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {(clientsByUser.get(u.userId) ?? []).map(c => (
                                  <span key={c.clientName} style={{ fontSize: '12px', padding: '3px 9px', borderRadius: '999px', background: BAR_SOFT }}>
                                    {c.clientName} · <b>{c.actions}</b>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
