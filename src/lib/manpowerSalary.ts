import csv from '../data/manpower_salary_data.csv?raw';

export interface SalaryEntry {
  salary: number;
  conveyance: number;
}

const toNumber = (v: string) => Number((v || '').replace(/,/g, '').trim()) || 0;

// Keyed only by STD/EMP ID (upper-cased). Columns after the ID are salary and conveyance.
export const SALARY_BY_ID: Map<string, SalaryEntry> = new Map(
  csv
    .split(/\r?\n/)
    .slice(1)
    .filter(l => l.trim())
    .map(line => {
      const cols = line.match(/("([^"]*)"|[^,]+)/g) || [];
      const clean = (c?: string) => (c || '').replace(/^"|"$/g, '');
      return [
        clean(cols[0]).trim().toUpperCase(),
        { salary: toNumber(clean(cols[1])), conveyance: toNumber(clean(cols[2])) }
      ] as [string, SalaryEntry];
    })
);
