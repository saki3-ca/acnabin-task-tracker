import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { createClient } from '@supabase/supabase-js';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

// 1. Read environment variables from .env
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
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function cleanString(val: any): string {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (s === '-' || s.toLowerCase() === 'none') return '';
  return s;
}

function cleanPhone(val: any): string {
  if (val === null || val === undefined) return '';
  let s = String(val).trim();
  s = s.replace(/^'+/, '').trim();
  if (s === '-' || s.toLowerCase() === 'none') return '';
  return s;
}

function cleanDesignation(val: any): string {
  let s = cleanString(val);
  if (!s) return '';
  // Fix known typos and trailing whitespace
  const lower = s.toLowerCase();
  if (lower === 'assitant director') return 'Assistant Director';
  if (lower === 'director') return 'Director';
  if (lower === 'deputy director') return 'Deputy Director';
  if (lower === 'senior assistant manager') return 'Senior Assistant Manager';
  return s;
}

function cleanNumber(val: any): number {
  if (val === null || val === undefined || val === '' || val === '-') return 0;
  const num = Number(val);
  return isNaN(num) ? 0 : num;
}

function normalizeClient(name: string): string {
  return name
    .trim()
    .replace(/\s*plc\.?$/i, '')
    .replace(/\.$/, '')
    .trim()
    .toLowerCase();
}

async function main() {
  console.log('=== ACNABIN Manpower Import Script ===\n');

  // Locate the Excel file
  let excelPath = path.resolve(process.cwd(), 'Manpower_data_up.xlsx');
  if (!fs.existsSync(excelPath)) {
    excelPath = path.resolve(process.cwd(), 'Manpower data up.xlsx');
  }
  if (!fs.existsSync(excelPath)) {
    console.error(`Error: Excel file not found at ${excelPath}`);
    process.exit(1);
  }

  console.log(`Reading Excel file: ${excelPath}`);
  const workbook = XLSX.readFile(excelPath);
  const sheetName = 'All Manpower (2)';
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    console.error(`Error: Sheet "${sheetName}" not found in workbook. Available:`, workbook.SheetNames);
    process.exit(1);
  }

  // Convert sheet to row array (0-indexed)
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
  console.log(`Total sheet rows: ${rows.length}`);

  // Fetch clients from Supabase for ID matching
  console.log('Fetching clients from Supabase for client matching...');
  const { data: dbClients, error: clientsErr } = await supabase.from('clients').select('id, name');
  if (clientsErr) {
    console.warn('Warning: Could not fetch clients from Supabase:', clientsErr.message);
  }
  const clientList = dbClients || [];
  console.log(`Found ${clientList.length} clients in Supabase.`);

  // Row 5 is header (index 4), data starts at row 6 (index 5)
  const headerRow = rows[4] || [];
  console.log('Headers detected:', headerRow.slice(0, 13));

  const records: any[] = [];
  const csvRows: string[] = [
    'emp_id,name,client_id,client_name,designation,academic_year,salary,conveyance,total,contact_number,email,education,remarks'
  ];

  for (let r = 5; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0 || !row.some(cell => cell !== null && cell !== '')) {
      continue;
    }

    const sl = row[0];
    const rawId = row[1];
    const rawName = row[2];
    const rawClient = row[3];
    const rawDesig = row[4];
    const rawAcad = row[5];
    const rawSalary = row[6];
    const rawConv = row[7];
    const rawTotal = row[8];
    const rawContact = row[9];
    const rawEmail = row[10];
    const rawEdu = row[11];
    const rawRemarks = row[12];

    let empId = cleanString(rawId);
    if (!empId || empId === 'Missing ID') {
      empId = `MISSING-${sl || r + 1}`;
    }

    const name = cleanString(rawName);
    const clientName = cleanString(rawClient);
    const designation = cleanDesignation(rawDesig);
    const academicYear = cleanString(rawAcad);
    const salary = cleanNumber(rawSalary);
    const conveyance = cleanNumber(rawConv);
    let total = cleanNumber(rawTotal);
    if (total === 0 && (salary > 0 || conveyance > 0)) {
      total = salary + conveyance;
    }

    const contactNumber = cleanPhone(rawContact);
    const email = cleanString(rawEmail);
    const education = cleanString(rawEdu);
    const remarks = cleanString(rawRemarks);

    // Match client
    let matchedClientId: string | null = null;
    if (clientName) {
      const normRaw = normalizeClient(clientName);
      const match = clientList.find(c => normalizeClient(c.name) === normRaw);
      if (match) {
        matchedClientId = match.id;
      }
    }

    const record = {
      emp_id: empId,
      name,
      client_id: matchedClientId,
      client_name: clientName,
      designation,
      academic_year: academicYear,
      salary,
      conveyance,
      total,
      contact_number: contactNumber,
      email,
      education,
      remarks,
      updated_at: new Date().toISOString()
    };

    records.push(record);

    // Escape for CSV
    const csvEscape = (field: any) => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    csvRows.push([
      csvEscape(record.emp_id),
      csvEscape(record.name),
      csvEscape(record.client_id || ''),
      csvEscape(record.client_name),
      csvEscape(record.designation),
      csvEscape(record.academic_year),
      record.salary,
      record.conveyance,
      record.total,
      csvEscape(record.contact_number),
      csvEscape(record.email),
      csvEscape(record.education),
      csvEscape(record.remarks)
    ].join(','));
  }

  console.log(`Processed ${records.length} manpower records.`);

  // Write CSV artifact for manual dashboard import if desired
  const csvPath = path.resolve(process.cwd(), 'manpower_clean_import.csv');
  fs.writeFileSync(csvPath, csvRows.join('\n'), 'utf-8');
  console.log(`Wrote clean CSV to: ${csvPath} (ignored in .gitignore)`);

  // Upsert to Supabase
  console.log('Upserting records to Supabase table "public.manpower"...');
  const { data: upsertData, error: upsertErr } = await supabase
    .from('manpower')
    .upsert(records, { onConflict: 'emp_id' });

  if (upsertErr) {
    console.error('Upsert failed:', upsertErr.message);
    console.log('\nYou can alternatively import "manpower_clean_import.csv" directly into your Supabase Dashboard:');
    console.log('1. Go to Supabase Dashboard -> Table Editor -> manpower');
    console.log('2. Click "Insert" -> "Import data from CSV" -> select manpower_clean_import.csv');
  } else {
    console.log(`\nSUCCESS! Successfully upserted ${records.length} records into Supabase "manpower" table.`);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
