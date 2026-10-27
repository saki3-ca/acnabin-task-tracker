import { createContext, useContext } from 'react';

export type FcTheme = 'classic' | 'glass';

export interface FcColors {
  revenue: string;
  cost: string;
  gain: string;
  loss: string;
  warn: string;
  /** axis lines and grid */
  grid: string;
  /** small labels */
  text: string;
  /** main text inside charts */
  ink: string;
  /** empty bar track / ring track */
  track: string;
  /** zebra rows */
  stripe: string;
  /** gap between donut slices */
  gap: string;
  palette: string[];
  /** fully rounded (pill) bars, as in liquid glass */
  pill: boolean;
  /** colours for a light (butter) card inside a dark theme */
  light?: FcColors;
}

const light: FcColors = {
  revenue: '#1D8C8C',
  cost: '#3D6FB6',
  gain: '#2E8B57',
  loss: '#C0392B',
  warn: '#E8643C',
  grid: '#E5DED3',
  text: '#5A544E',
  ink: '#221F1D',
  track: 'rgba(90,84,78,0.16)',
  stripe: 'rgba(255,255,255,0.35)',
  gap: 'rgba(255,255,255,0.85)',
  pill: false,
  palette: ['#1F3A5F', '#B08D57', '#0F5E57', '#7A1F2B', '#8E9AAF', '#4A3F6B', '#A0643A', '#5E7D6B', '#C9A9A6', '#2E4A5A', '#D8C3A5', '#6B4E3D', '#9C7A97']
};

/** Classic: the app's own colours on a light backdrop, nothing decorative */
const classic: FcColors = {
  revenue: '#1D8C8C',
  cost: '#3D5A99',
  gain: '#2E8B57',
  loss: '#C0392B',
  warn: '#D98E04',
  grid: 'rgba(90,84,78,0.18)',
  text: '#5A544E',
  ink: '#221F1D',
  track: 'rgba(90,84,78,0.14)',
  stripe: 'rgba(255,255,255,0.4)',
  gap: 'rgba(255,255,255,0.9)',
  pill: false,
  palette: ['#1F3A5F', '#B08D57', '#0F5E57', '#7A1F2B', '#8E9AAF', '#4A3F6B', '#A0643A', '#5E7D6B', '#C9A9A6', '#2E4A5A', '#D8C3A5', '#6B4E3D', '#9C7A97']
};

/** Marks on a light butter card in Vivid: deep green, signal violet, dark lime, red */
const vividLight: FcColors = {
  revenue: '#013e37',
  cost: '#7A35FF',
  gain: '#6f9a00',
  loss: '#e03a3e',
  warn: '#f9100c',
  grid: 'rgba(1,62,55,0.16)',
  text: 'rgba(1,62,55,0.75)',
  ink: '#013e37',
  track: 'rgba(1,62,55,0.14)',
  stripe: 'rgba(1,62,55,0.05)',
  gap: 'rgba(255,251,234,0.9)',
  pill: false,
  palette: ['#013e37', '#7A35FF', '#FF6115', '#39FF88', '#B7FF72', '#f15153', '#fbe311', '#0B132B', '#9D6BFF', '#7FE0C0', '#ff9a62', '#8fd14f']
};

/** Liquid glass palette: Mint #77dfc0, Lavender #c9a4eb, Coral #f68b8b, Amber #fef08a */
const glass: FcColors = {
  revenue: '#77dfc0',
  cost: '#c9a4eb',
  gain: '#77dfc0',
  loss: '#f68b8b',
  warn: '#fef08a',
  grid: 'rgba(255, 255, 255, 0.15)',
  text: 'rgba(255, 255, 255, 0.75)',
  ink: '#FFFFFF',
  track: 'rgba(255, 255, 255, 0.14)',
  stripe: 'rgba(255, 255, 255, 0.05)',
  gap: 'rgba(0, 0, 0, 0.35)',
  pill: true,
  palette: ['#77dfc0', '#c9a4eb', '#f68b8b', '#fef08a', '#60a5fa', '#34d399', '#a78bfa', '#f472b6', '#38bdf8', '#818cf8']
};

export const THEME_COLORS: Record<FcTheme, FcColors> = { classic, glass };

export const THEMES: { id: FcTheme; label: string; note: string }[] = [
  { id: 'classic', label: 'Classic', note: 'Soft frosted white on warm cream, maroon and teal' },
  { id: 'glass', label: 'Glass', note: 'The app Glass look: frosted panels on a soft gradient' }
];

export const isFcTheme = (v: unknown): v is FcTheme => v === 'classic' || v === 'glass';

export const FcColorsContext = createContext<FcColors>(light);
export const useColors = (): FcColors => useContext(FcColorsContext);
