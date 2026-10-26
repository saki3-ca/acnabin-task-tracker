// Small dependency-free SVG charts for the Firm Costing dashboard.
import React, { useState } from 'react';
import { useColors } from './chartColors';
import { ClientTotals, MonthTotals, fmtBDT, fmtShort, monthLabel } from '../../lib/firmCosting';

const niceMax = (v: number): number => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p;
};

interface Tip { x: number; y: number; lines: string[] }

const TipBox: React.FC<{ tip: Tip | null; w: number }> = ({ tip, w }) => {
  if (!tip) return null;
  const bw = 170;
  const bh = 14 + tip.lines.length * 15;
  const x = Math.min(Math.max(tip.x - bw / 2, 2), w - bw - 2);
  const y = Math.max(tip.y - bh - 8, 2);
  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={bw} height={bh} rx={6} fill="#221F1D" stroke="rgba(255,255,255,0.25)" opacity={0.96} />
      {tip.lines.map((l, i) => (
        <text key={i} x={x + 9} y={y + 17 + i * 15} fontSize={11} fill="#fff" fontWeight={i === 0 ? 700 : 400}>{l}</text>
      ))}
    </g>
  );
};

/** Three bars per month: net revenue, cost, and profit (green, up) or loss (red, down). */
export const MonthlyCombo: React.FC<{ data: MonthTotals[] }> = ({ data }) => {
  const C = useColors();
  const [tip, setTip] = useState<Tip | null>(null);
  const W = 1100, H = 250, L = 76, R = 16, T = 14, B = 32;
  const iw = W - L - R, ih = H - T - B;
  const maxV = niceMax(Math.max(...data.map(d => Math.max(d.revenue, d.cost, d.profit)), 1));
  const minV = Math.min(...data.map(d => d.profit), 0);
  const lo = minV < 0 ? -niceMax(-minV) : 0;
  const y = (v: number) => T + ih - ((v - lo) / (maxV - lo)) * ih;
  const step = iw / Math.max(data.length, 1);
  const bw = Math.min(step * 0.24, 28);
  const ticks = [0, 1, 2, 3, 4].map(i => lo + ((maxV - lo) * i) / 4);
  const bar = (x: number, v: number, fill: string) => {
    const top = Math.min(y(v), y(0));
    return <rect x={x} y={top} width={bw} height={Math.max(Math.abs(y(v) - y(0)), v === 0 ? 0 : 1)} rx={C.pill ? bw / 2 : 2} fill={fill} />;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 300 }} role="img" aria-label="Revenue, cost and profit or loss by month" onMouseLeave={() => setTip(null)}>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={C.grid} strokeDasharray={t === 0 ? undefined : '3 3'} />
          <text x={L - 6} y={y(t) + 4} fontSize={10.5} fill={C.text} textAnchor="end">{fmtShort(t)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const cx = L + step * i + step / 2;
        return (
          <g key={d.month}
            onMouseMove={() => setTip({ x: cx, y: Math.min(y(d.revenue), y(d.cost), y(d.profit)), lines: [monthLabel(d.month, false), `Net revenue ${fmtBDT(d.revenue)}`, `Cost ${fmtBDT(d.cost)}`, `${d.profit < 0 ? 'Loss' : 'Profit'} ${fmtBDT(Math.abs(d.profit))}`] })}>
            <rect x={cx - step / 2} y={T} width={step} height={ih} fill="transparent" />
            {bar(cx - bw * 1.5 - 2, d.revenue, C.revenue)}
            {bar(cx - bw / 2, d.cost, C.cost)}
            {bar(cx + bw / 2 + 2, d.profit, d.profit < 0 ? C.loss : C.gain)}
            <text x={cx} y={H - 12} fontSize={10.5} fill={C.text} textAnchor="middle">{monthLabel(d.month)}</text>
          </g>
        );
      })}
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} stroke={C.text} strokeWidth={1} />
      <TipBox tip={tip} w={W} />
    </svg>
  );
};

export interface Slice { label: string; value: number }

/** Donut with a scrollable legend; every slice is shown. */
export const Donut: React.FC<{ slices: Slice[]; centerLabel: string; size?: number }> = ({ slices, centerLabel, size = 190 }) => {
  const C = useColors();
  const [hot, setHot] = useState<number | null>(null);
  // Real clients highest first; the "no client" bucket is not a client, so it goes last
  const isBucket = (l: string) => /^(No client|Unallocated)/.test(l);
  const sorted = slices.filter(s => s.value > 0).sort((a, b) => Number(isBucket(a.label)) - Number(isBucket(b.label)) || b.value - a.value);
  const items = sorted;
  // past the curated set, reuse it lighter, then darker, so every slice stays in the same muted family
  const colorOf = (i: number) => {
    const base = C.palette[i % C.palette.length];
    const round = Math.floor(i / C.palette.length);
    return round === 0 ? base : `color-mix(in srgb, ${base} ${round % 2 ? 62 : 74}%, ${round % 2 ? 'white' : 'black'})`;
  };
  const total = items.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return <div style={{ color: 'var(--ink-muted)', fontSize: 13, padding: 24 }}>No data for this selection.</div>;
  const R = 72, r = 52, cx = 90, cy = 90;
  const arcs = items.map((it, i) => {
    const before = items.slice(0, i).reduce((t, x) => t + x.value, 0);
    const a0 = -Math.PI / 2 + (before / total) * Math.PI * 2;
    const a1 = a0 + (it.value / total) * Math.PI * 2;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const full = items.length === 1;
    const p = (rad: number, a: number) => `${cx + rad * Math.cos(a)},${cy + rad * Math.sin(a)}`;
    const d = full
      ? `M${cx},${cy - R} A${R},${R} 0 1 1 ${cx - 0.01},${cy - R} L${cx - 0.01},${cy - r} A${r},${r} 0 1 0 ${cx},${cy - r} Z`
      : `M${p(R, a0)} A${R},${R} 0 ${large} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${large} 0 ${p(r, a0)} Z`;
    return { d, color: colorOf(i), it };
  });
  const shown = hot !== null ? items[hot] : null;
  const centerText = shown ? (shown.label.length > 18 ? shown.label.slice(0, 17) + '…' : shown.label) : centerLabel;
  return (
    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
      <svg viewBox="0 0 180 180" width={size} height={size} style={{ flexShrink: 0, alignSelf: 'center' }} role="img" aria-label={centerLabel}>
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill={a.color} stroke={C.gap} strokeWidth={0.6} opacity={hot === null || hot === i ? 1 : 0.45}
            onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)} />
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize={shown ? 11 : 10.5} fill={C.text}>{centerText}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={15} fontWeight={700} fill={C.ink}>{fmtShort(shown ? shown.value : total)}</text>
      </svg>
      <div style={{ flex: 1, minWidth: 150, fontSize: 12.5 }}>
        {items.map((it, i) => (
          <div key={`${i}-${it.label}`} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', opacity: hot === null || hot === i ? 1 : 0.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: colorOf(i), flexShrink: 0 }} />
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={it.label}>{it.label}</span>
            <span style={{ color: 'var(--ink-soft)', whiteSpace: 'nowrap', display: 'inline-flex', gap: 22 }}>
              <span style={{ minWidth: 78, textAlign: 'right' }}>{fmtShort(it.value)}</span>
              <span style={{ minWidth: 46, textAlign: 'right', fontWeight: 600, color: 'var(--ink)' }}>{((it.value / total) * 100).toFixed(1)}%</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Full name when it fits the label column, otherwise just the first name (two words when two clients share the first one). */
const MAX_LABEL = 19;
const labelFor = (name: string, all: string[]): string => {
  if (name.length <= MAX_LABEL) return name;
  const words = name.split(/\s+/);
  const first = words[0];
  const clash = all.some(n => n !== name && n.split(/\s+/)[0].toLowerCase() === first.toLowerCase() && n.length > MAX_LABEL);
  const short = clash ? words.slice(0, 2).join(' ') : first;
  return short.length > MAX_LABEL ? short.slice(0, MAX_LABEL - 1) + '…' : short;
};

/** Horizontal bars per client, one value each; negative values go left in red. */
export const ClientProfitBars: React.FC<{ clients: ClientTotals[]; limit?: number }> = ({ clients, limit = 12 }) => {
  const C = useColors();
  const list = [...clients].sort((a, b) => b.profit - a.profit);
  const shown = list.length > limit ? [...list.slice(0, Math.ceil(limit / 2)), ...list.slice(-Math.floor(limit / 2))] : list;
  if (shown.length === 0) return <div style={{ color: 'var(--ink-muted)', fontSize: 13, padding: 24 }}>No data for this selection.</div>;
  const rowH = 24, nameW = 150, W = 640, pad = 64;
  const names = shown.map(c => c.clientName);
  const maxAbs = Math.max(...shown.map(c => Math.abs(c.profit)), 1);
  const minP = Math.min(...shown.map(c => c.profit), 0);
  const barArea = W - nameW - pad;
  // room left of zero for the loss bars and their number, so a loss label never sits on a client name
  const negRoom = minP < 0 ? Math.max((Math.abs(minP) / maxAbs) * barArea * 0.5, 56) : 0;
  const zero = nameW + negRoom;
  const scale = (barArea - negRoom) / maxAbs;
  const H = shown.length * rowH + 8;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Profit or loss by client">
      <line x1={zero} x2={zero} y1={0} y2={H} stroke={C.grid} />
      {shown.map((c, i) => {
        const y0 = 4 + i * rowH;
        const w = Math.abs(c.profit) * scale;
        const x = c.profit >= 0 ? zero : zero - w;
        return (
          <g key={c.clientId}>
            <title>{`${c.clientName}: ${c.profit < 0 ? 'loss' : 'profit'} ${fmtBDT(Math.abs(c.profit))}`}</title>
            <text x={nameW - 8} y={y0 + 15} fontSize={11.5} fill={C.ink} textAnchor="end">{labelFor(c.clientName, names)}</text>
            <rect x={x} y={y0 + 3} width={Math.max(w, 1)} height={rowH - 8} rx={C.pill ? (rowH - 8) / 2 : 3} fill={c.profit >= 0 ? C.gain : C.loss} />
            <text x={c.profit >= 0 ? x + w + 5 : x - 5} y={y0 + 15} fontSize={10.5} fill={C.text} textAnchor={c.profit >= 0 ? 'start' : 'end'}>{fmtShort(c.profit)}</text>
          </g>
        );
      })}
    </svg>
  );
};

/** Budget against actual net revenue per client. */
export const BudgetBars: React.FC<{ clients: ClientTotals[]; limit?: number }> = ({ clients, limit = 10 }) => {
  const C = useColors();
  const list = clients.filter(c => c.budget > 0).sort((a, b) => b.budget - a.budget).slice(0, limit);
  if (list.length === 0) return <div style={{ color: 'var(--ink-muted)', fontSize: 13, padding: 24 }}>No budget entered for this selection.</div>;
  const rowH = 28, nameW = 150, W = 640, pad = 70;
  const max = Math.max(...list.map(c => Math.max(c.budget, c.revenue)), 1);
  const sc = (W - nameW - pad) / max;
  return (
    <svg viewBox={`0 0 ${W} ${list.length * rowH + 8}`} width="100%" role="img" aria-label="Budget against actual revenue by client">
      {list.map((c, i) => {
        const y0 = 4 + i * rowH;
        const pct = (c.revenue / c.budget) * 100;
        return (
          <g key={c.clientId}>
            <title>{`${c.clientName}: budget ${fmtBDT(c.budget)}, actual ${fmtBDT(c.revenue)} (${pct.toFixed(0)}%)`}</title>
            <text x={nameW - 8} y={y0 + 17} fontSize={11.5} fill={C.ink} textAnchor="end">{labelFor(c.clientName, list.map(x => x.clientName))}</text>
            <rect x={nameW} y={y0 + 4} width={c.budget * sc} height={rowH - 12} rx={C.pill ? (rowH - 12) / 2 : 3} fill={C.track} />
            <rect x={nameW} y={y0 + 7} width={Math.max(c.revenue * sc, 1)} height={rowH - 18} rx={C.pill ? (rowH - 18) / 2 : 2} fill={pct >= 100 ? C.gain : C.revenue} />
            <text x={nameW + Math.max(c.budget, c.revenue) * sc + 6} y={y0 + 17} fontSize={10.5} fill={C.text}>{pct.toFixed(0)}%</text>
          </g>
        );
      })}
    </svg>
  );
};

/** Tiny bars of one value per month (profit above zero in green, loss below in red). */
export const MiniBars: React.FC<{ values: number[] }> = ({ values }) => {
  const C = useColors();
  if (values.length === 0) return null;
  const W = 220, H = 56, mid = H / 2;
  const max = Math.max(...values.map(Math.abs), 1);
  const step = W / values.length;
  const bw = Math.min(step * 0.6, 18);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={56} role="img" aria-label="Monthly profit trend" preserveAspectRatio="none">
      <line x1={0} x2={W} y1={mid} y2={mid} stroke={C.grid} />
      {values.map((v, i) => {
        const h = Math.max((Math.abs(v) / max) * (mid - 3), 2);
        return <rect key={i} x={step * i + (step - bw) / 2} y={v >= 0 ? mid - h : mid} width={bw} height={h} rx={C.pill ? bw / 2 : 3} fill={v >= 0 ? C.gain : C.loss} opacity={0.9} />;
      })}
    </svg>
  );
};

/** Circular progress (budget achieved). */
export const Ring: React.FC<{ pct: number; label: string }> = ({ pct, label }) => {
  const C = useColors();
  const r = 22, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(pct, 100));
  return (
    <svg viewBox="0 0 56 56" width={56} height={56} role="img" aria-label={`${label} ${pct.toFixed(0)}%`}>
      <circle cx={28} cy={28} r={r} fill="none" stroke={C.track} strokeWidth={6} />
      <circle cx={28} cy={28} r={r} fill="none" stroke={pct >= 100 ? C.gain : C.warn} strokeWidth={6} strokeLinecap="round"
        strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 28 28)" />
      <text x={28} y={32} textAnchor="middle" fontSize={11} fontWeight={700} fill={C.ink}>{pct.toFixed(0)}%</text>
    </svg>
  );
};

export interface MiniPoint { label: string; value: number }

export interface ProjectionPoint { label: string; value: number; projected: boolean }

/** Bars of net revenue: the last months as they were (solid) and the next months as projected (light, dashed edge). */
export const ProjectionBars: React.FC<{ data: ProjectionPoint[] }> = ({ data }) => {
  const C = useColors();
  if (data.length === 0) return null;
  const W = 520, H = 105, L = 10, R = 10, T = 18, B = 20;
  const iw = W - L - R, ih = H - T - B;
  const max = Math.max(...data.map(d => d.value), 1);
  const step = iw / data.length;
  const bw = Math.min(step * 0.34, 24);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 120 }} role="img" aria-label="Net revenue: last months and projected months">
      <line x1={L} x2={W - R} y1={T + ih} y2={T + ih} stroke={C.grid} />
      {data.map((d, i) => {
        const cx = L + step * i + step / 2;
        const h = Math.max((d.value / max) * ih, d.value > 0 ? 2 : 0);
        return (
          <g key={d.label + i}>
            <title>{`${d.label}${d.projected ? ' (projected)' : ''}: ${fmtBDT(d.value)}`}</title>
            <rect x={cx - bw / 2} y={T + ih - h} width={bw} height={h} rx={C.pill ? bw / 2 : 3}
              fill={C.revenue} fillOpacity={d.projected ? 0.28 : 0.95}
              stroke={d.projected ? C.revenue : 'none'} strokeDasharray={d.projected ? '4 3' : undefined} strokeWidth={1.4} />
            <text x={cx} y={T + ih - h - 5} fontSize={9} fill={C.ink} textAnchor="middle">{fmtShort(d.value)}</text>
            <text x={cx} y={H - 7} fontSize={9} fill={C.text} textAnchor="middle">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
};
