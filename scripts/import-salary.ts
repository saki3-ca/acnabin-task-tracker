import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Loads salary / conveyance / total for existing manpower rows from a git-ignored CSV.
// Only rows whose STD/EMP ID already exists in public.manpower are updated;
// IDs with no match are reported and left untouched (their fields stay blank as before).
//
// Usage: npx tsx scripts/import-salary.ts [path/to/file.csv] [--dry-run]

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  }
  return env;
}

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function toNumber(val: string): number {
  const n = Number((val || '').replace(/,/g, '').trim());
  return isNaN(n) ? 0 : n;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const csvPath = path.resolve(process.cwd(), args.find(a => !a.startsWith('--')) || 'manpower_salary_data.csv');

  const env = loadEnv();
  const supabaseUrl = env['VITE_SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'];
  const supabaseKey = env['VITE_SUPABASE_ANON_KEY'] || process.env['VITE_SUPABASE_ANON_KEY'];
  if (!supabaseUrl || !supabaseKey) {
    console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
    process.exit(1);
  }
  if (!fs.existsSync(csvPath)) {
    console.error(`Error: CSV not found at ${csvPath}`);
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const lines = fs.readFileSync(csvPath, 'utf-8').split(/\r?\n/).filter(l => l.trim());
  const rows = lines.slice(1).map(parseCsvLine).map(c => {
    const salary = toNumber(c[1]);
    const conveyance = toNumber(c[2]);
    return { empId: (c[0] || '').trim(), salary, conveyance, total: salary + conveyance };
  }).filter(r => r.empId);

  const { data: existing, error } = await supabase.from('manpower').select('emp_id');
  if (error) {
    console.error('Could not read manpower table:', error.message);
    process.exit(1);
  }
  const idMap = new Map<string, string>();
  (existing || []).forEach((r: any) => idMap.set(String(r.emp_id).trim().toUpperCase(), r.emp_id));

  const matched = rows.filter(r => idMap.has(r.empId.toUpperCase()));
  const unmatched = rows.filter(r => !idMap.has(r.empId.toUpperCase()));

  console.log(`CSV rows: ${rows.length} | matched: ${matched.length} | unmatched: ${unmatched.length}`);
  if (unmatched.length) console.log('Unmatched IDs (skipped):', unmatched.map(r => r.empId).join(', '));
  if (dryRun) {
    console.log('Dry run - nothing written.');
    return;
  }

  let updated = 0;
  for (const r of matched) {
    const { error: upErr } = await supabase
      .from('manpower')
      .update({ salary: r.salary, conveyance: r.conveyance, total: r.total, updated_at: new Date().toISOString() })
      .eq('emp_id', idMap.get(r.empId.toUpperCase())!);
    if (upErr) console.error(`Failed ${r.empId}: ${upErr.message}`);
    else updated++;
  }
  console.log(`Updated ${updated}/${matched.length} matched records.`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
