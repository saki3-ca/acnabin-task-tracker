import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(): Record<string, string> {
  const envPath = path.resolve(process.cwd(), '.env');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        env[key] = val;
      }
    }
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env['VITE_SUPABASE_URL'] || process.env['VITE_SUPABASE_URL'];
const supabaseKey = env['VITE_SUPABASE_ANON_KEY'] || process.env['VITE_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: Supabase credentials not found in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getTimestampString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}_${hh}${min}`;
}

const TABLES = [
  'users',
  'clients',
  'tasks',
  'manager_client_access',
  'manager_student_access',
  'notifications',
  'task_requests',
  'manpower'
];

async function backupTable(table: string): Promise<any[]> {
  try {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.warn(`[${table}] Note: Query returned warning or table does not exist: ${error.message}`);
      return [];
    }
    return data || [];
  } catch (err: any) {
    console.warn(`[${table}] Query error: ${err.message}`);
    return [];
  }
}

async function main() {
  const timestamp = getTimestampString();
  const backupDir = path.resolve(process.cwd(), 'backups', timestamp);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  console.log(`Starting backup to: ${backupDir}\n`);

  const results: Record<string, { count: number; file: string; exists: boolean }> = {};

  for (const table of TABLES) {
    console.log(`Backing up table "${table}"...`);
    const data = await backupTable(table);
    const filePath = path.join(backupDir, `${table}.json`);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    const exists = fs.existsSync(filePath);
    results[table] = {
      count: data.length,
      file: filePath,
      exists
    };
    console.log(`  -> Saved ${data.length} rows to ${table}.json (file exists: ${exists})`);
  }

  console.log('\n=== BACKUP SUMMARY ===');
  console.log(`Timestamp Directory: backups/${timestamp}`);
  for (const [tbl, info] of Object.entries(results)) {
    console.log(` - ${tbl}: ${info.count} rows (Verified: ${info.exists})`);
  }
}

main().catch(err => {
  console.error('Fatal error during backup:', err);
  process.exit(1);
});
