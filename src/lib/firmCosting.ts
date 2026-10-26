// Firm Costing maths: invoice value (includes VAT and tax) -> net revenue, joined to manpower cost per client.
import { Client, FirmCostingRow, ManpowerRecord } from '../types';
import { manpowerService } from '../services/manpowerService';
import { DEFAULT_TDS_PCT, DEFAULT_VAT_PCT, MONTHS } from './invoices';

export const UNALLOCATED_ID = '__UNALLOCATED__';

/** Net revenue = invoice value without the VAT and tax in it. */
export const netRevenue = (r: Pick<FirmCostingRow, 'invoiceValue' | 'vat' | 'tax'>): number =>
  r.invoiceValue - r.vat - r.tax;

/** Suggested VAT and tax parts of an invoice value (same rule as the Invoices tab: value includes VAT, tax is a share of the value without VAT). */
export const suggestParts = (value: number, vatPct = DEFAULT_VAT_PCT, taxPct = DEFAULT_TDS_PCT) => {
  if (!(value > 0)) return { vat: 0, tax: 0 };
  const base = value / (1 + vatPct / 100);
  return { vat: Math.round((base * vatPct) / 100), tax: Math.round((base * taxPct) / 100) };
};

export interface ClientCost {
  clientId: string;
  people: number;
  salary: number;
  conveyance: number;
}

/** Manpower cost per client (a person counts once, under their primary client). Needs Admin / AD and above. */
export async function loadClientCosts(): Promise<Map<string, ClientCost>> {
  const [records, salaries] = await Promise.all([
    manpowerService.getManpower({ includeAll: false }),
    manpowerService.getSalaries()
  ]);
  const byId = new Map(salaries.map(s => [s.empId.trim().toUpperCase(), s]));
  const out = new Map<string, ClientCost>();
  (records as ManpowerRecord[]).forEach(r => {
    const hit = byId.get((r.empId || '').trim().toUpperCase());
    const salary = hit ? hit.salary : Number(r.salary) || 0;
    const conveyance = hit ? hit.conveyance : Number(r.conveyance) || 0;
    const id = (r.clientIds && r.clientIds[0]) || r.clientId || UNALLOCATED_ID;
    const c = out.get(id) || { clientId: id, people: 0, salary: 0, conveyance: 0 };
    c.people += 1;
    c.salary += salary;
    c.conveyance += conveyance;
    out.set(id, c);
  });
  return out;
}

export const monthLabel = (ym: string, short = true): string => {
  const [y, m] = ym.split('-').map(Number);
  const name = MONTHS[(m || 1) - 1] || '';
  return `${short ? name.slice(0, 3) : name} ${short ? String(y).slice(2) : y}`;
};

export const currentMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export const prevMonth = (ym: string): string => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Every month from a to b (inclusive), oldest first. */
export const monthRange = (a: string, b: string): string[] => {
  const out: string[] = [];
  let cur = a;
  for (let i = 0; i < 240 && cur <= b; i++) {
    out.push(cur);
    const [y, m] = cur.split('-').map(Number);
    const d = new Date(y, m, 1);
    cur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return out;
};

/** Full amount with thousands commas: 1,018,000 */
export const fmtShort = (n: number): string => `${n < 0 ? '-' : ''}${Math.round(Math.abs(n)).toLocaleString('en-US')}`;

export const fmtBDT = (n: number): string => `৳ ${Math.round(n).toLocaleString('en-US')}`;

export interface MonthTotals {
  month: string;
  revenue: number;
  /** Invoice value including VAT and tax */
  gross: number;
  cost: number;
  profit: number;
  budget: number;
}

export interface ClientTotals {
  clientId: string;
  clientName: string;
  engagement: 'RECURRING' | 'ONE_TIME';
  /** months that have a row, oldest first */
  months: string[];
  gross: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number | null;
  budget: number;
  people: number;
}

export interface CostingSummary {
  months: string[];
  perMonth: MonthTotals[];
  perClient: ClientTotals[];
  /** Manpower cost of every client over the period (billed or not), from the Manpower tab */
  costByClient: { clientId: string; clientName: string; people: number; cost: number }[];
  gross: number;
  revenue: number;
  cost: number;
  /** manpower cost that cannot be pinned on an invoiced client that month (no client, or no invoice that month) */
  unallocatedCost: number;
  profit: number;
  margin: number | null;
  budget: number;
  headcount: number;
}

/**
 * Cost model: a client's monthly cost is its manpower cost (salary, plus conveyance when asked), counted in every month it has a row.
 * Manpower cost of people with no client, or of clients with no row that month, is firm overhead: it is in the firm cost
 * and profit but in no client's line.
 */
export function summarize(
  rows: FirmCostingRow[],
  costs: Map<string, ClientCost>,
  includeConveyance: boolean,
  months: string[],
  clientId: string,
  nameOf: (id: string) => string = id => id
): CostingSummary {
  const costOf = (id: string) => {
    const c = costs.get(id);
    return c ? c.salary + (includeConveyance ? c.conveyance : 0) : 0;
  };
  const monthSet = new Set(months);
  const inRange = rows.filter(r => monthSet.has(r.month));
  const scoped = clientId ? inRange.filter(r => r.clientId === clientId) : inRange;

  let totalFirmMonthlyCost = 0;
  costs.forEach((_, id) => { totalFirmMonthlyCost += costOf(id); });
  let headcount = 0;
  costs.forEach(c => { headcount += c.people; });

  const perMonth: MonthTotals[] = months.map(month => {
    const mr = scoped.filter(r => r.month === month);
    const revenue = mr.reduce((s, r) => s + netRevenue(r), 0);
    const gross = mr.reduce((s, r) => s + r.invoiceValue, 0);
    const budget = mr.reduce((s, r) => s + r.budget, 0);
    const cost = clientId
      ? (mr.length ? costOf(clientId) : 0)
      : totalFirmMonthlyCost;
    return { month, revenue, gross, cost, profit: revenue - cost, budget };
  });

  const byClient = new Map<string, ClientTotals>();
  scoped.forEach(r => {
    let c = byClient.get(r.clientId);
    if (!c) {
      c = {
        clientId: r.clientId, clientName: r.clientName, engagement: r.engagement, months: [],
        gross: 0, revenue: 0, cost: 0, profit: 0, margin: null, budget: 0, people: costs.get(r.clientId)?.people || 0
      };
      byClient.set(r.clientId, c);
    }
    // several invoice lines in one month: the month and its manpower cost count once
    if (!c.months.includes(r.month)) {
      c.months.push(r.month);
      c.cost += costOf(r.clientId);
    }
    c.gross += r.invoiceValue;
    c.revenue += netRevenue(r);
    c.budget += r.budget;
    c.engagement = r.engagement;
    c.clientName = r.clientName;
  });
  const perClient = Array.from(byClient.values()).map(c => {
    c.months.sort();
    c.profit = c.revenue - c.cost;
    c.margin = c.revenue > 0 ? (c.profit / c.revenue) * 100 : null;
    return c;
  }).sort((a, b) => b.revenue - a.revenue);

  const costByClient = Array.from(costs.values())
    .filter(c => !clientId || c.clientId === clientId)
    .map(c => ({
      clientId: c.clientId,
      clientName: c.clientId === UNALLOCATED_ID ? 'No client / all clients' : nameOf(c.clientId),
      people: c.people,
      cost: costOf(c.clientId) * months.length
    }))
    .filter(c => c.cost > 0)
    .sort((a, b) => b.cost - a.cost);

  const gross = perMonth.reduce((s, m) => s + m.gross, 0);
  const revenue = perMonth.reduce((s, m) => s + m.revenue, 0);
  const cost = perMonth.reduce((s, m) => s + m.cost, 0);
  const budget = perMonth.reduce((s, m) => s + m.budget, 0);
  const clientCost = perClient.reduce((s, c) => s + c.cost, 0);
  return {
    months, perMonth, perClient, costByClient, gross, revenue, cost,
    unallocatedCost: clientId ? 0 : Math.max(cost - clientCost, 0),
    profit: revenue - cost,
    margin: revenue > 0 ? ((revenue - cost) / revenue) * 100 : null,
    budget,
    headcount: clientId ? (costs.get(clientId)?.people || 0) : headcount
  };
}

export const clientNameOf = (clients: Client[], id: string, fallback = ''): string =>
  clients.find(c => c.id === id)?.name || fallback;

export const addMonths = (ym: string, n: number): string => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export interface Projection {
  /** newest month with figures */
  lastMonth: string;
  recurringClients: number;
  /** net revenue per month if every recurring client bills what it billed last */
  monthlyRevenue: number;
  monthlyCost: number;
  history: { month: string; revenue: number }[];
  future: { month: string; revenue: number; cost: number; profit: number }[];
  totalRevenue: number;
  totalProfit: number;
}

/**
 * Simple run-rate forecast: every recurring client that is still active (billed in the last 3 months of data)
 * is assumed to bill again what it billed in its latest month; one-time clients are left out.
 * Cost is the current manpower cost per month.
 */
export function projectRevenue(
  rows: FirmCostingRow[],
  costs: Map<string, ClientCost>,
  includeConveyance: boolean,
  clientId: string,
  horizon = 3
): Projection | null {
  const scoped = clientId ? rows.filter(r => r.clientId === clientId) : rows;
  if (scoped.length === 0) return null;
  const lastMonth = scoped.reduce((m, r) => (r.month > m ? r.month : m), '');
  const cutoff = addMonths(lastMonth, -2);

  const latestOf = new Map<string, string>();
  scoped.forEach(r => { if (r.month > (latestOf.get(r.clientId) || '')) latestOf.set(r.clientId, r.month); });

  let monthlyRevenue = 0;
  let recurringClients = 0;
  latestOf.forEach((month, id) => {
    const lines = scoped.filter(r => r.clientId === id && r.month === month);
    if (lines[0].engagement !== 'RECURRING' || month < cutoff) return;
    recurringClients += 1;
    monthlyRevenue += lines.reduce((t, r) => t + netRevenue(r), 0);
  });

  const costOf = (id: string) => {
    const c = costs.get(id);
    return c ? c.salary + (includeConveyance ? c.conveyance : 0) : 0;
  };
  let monthlyCost = 0;
  if (clientId) monthlyCost = costOf(clientId);
  else costs.forEach((_, id) => { monthlyCost += costOf(id); });

  const history = [-2, -1, 0].map(k => {
    const month = addMonths(lastMonth, k);
    return { month, revenue: scoped.filter(r => r.month === month).reduce((t, r) => t + netRevenue(r), 0) };
  });
  const future = Array.from({ length: horizon }, (_, i) => ({
    month: addMonths(lastMonth, i + 1),
    revenue: monthlyRevenue,
    cost: monthlyCost,
    profit: monthlyRevenue - monthlyCost
  }));
  return {
    lastMonth, recurringClients, monthlyRevenue, monthlyCost, history, future,
    totalRevenue: future.reduce((t, f) => t + f.revenue, 0),
    totalProfit: future.reduce((t, f) => t + f.profit, 0)
  };
}
