// Academic year (students) and employment year (employees), calculated from a start date, plus the list of principals.

export const PRINCIPALS = [
  'Abu Sayed Mohammed Nayeem',
  'Iftekhar Hossain',
  'Abu Taher Mohammed Abdul Bari',
  'Md. Moniruzzaman',
  'Md. Rokonuzzaman',
  'Md. Mominul Karim',
  'Md. Reajul Islam',
  'Muhammad Aminul Hoque'
];

/** "Iftekhar Hossain" -> "Iftekhar Hossain, FCA" */
export const principalDisplay = (name?: string | null) => (name && name.trim() ? `${name.trim()}, FCA` : '');

const squash = (s: string) =>
  s.toLowerCase().replace(/,?\s*fca\b\.?/g, '').replace(/[^a-z]/g, '');

const PRINCIPAL_ALIASES: Record<string, string> = {
  asmnayeem: 'Abu Sayed Mohammed Nayeem',
  abusayedmohammednayeem: 'Abu Sayed Mohammed Nayeem',
  atmabari: 'Abu Taher Mohammed Abdul Bari',
  abutahermohammedabdulbari: 'Abu Taher Mohammed Abdul Bari'
};

/** Map any spelling from the sheet ("A.S.M Nayeem, FCA", "Md. Rokonuzzaman FCA") to the full name; unknown names come back cleaned of " FCA". */
export function canonicalPrincipal(raw?: string | null): string {
  const cleaned = String(raw ?? '').replace(/,?\s*FCA\b\.?/gi, '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const key = squash(cleaned);
  if (PRINCIPAL_ALIASES[key]) return PRINCIPAL_ALIASES[key];
  const hit = PRINCIPALS.find(p => squash(p) === key);
  return hit || cleaned;
}

const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10 > 3 ? 0 : n % 10]}`;

/** Full years between two ISO dates (anniversary based), never negative. */
export function fullYearsBetween(startIso: string, todayIso: string): number {
  const [sy, sm, sd] = startIso.split('-').map(Number);
  const [ty, tm, td] = todayIso.split('-').map(Number);
  let years = ty - sy;
  if (tm < sm || (tm === sm && td < sd)) years--;
  return Math.max(0, years);
}

export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isIso = (s?: string | null): s is string => Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));

/**
 * Student academic year from the articleship start date: 1st Year for the first 12 months, 2nd Year for the
 * next, and so on, up to 4th Year. After the articleship end date it says "Completed".
 * Returns '' when there is no usable start date (keep whatever year was typed instead).
 */
export function academicYearFromStart(startIso?: string | null, endIso?: string | null, today = todayIso()): string {
  if (!isIso(startIso)) return '';
  if (isIso(endIso) && today > endIso) return 'Completed';
  return `${ordinal(Math.min(fullYearsBetween(startIso, today) + 1, 4))} Year`;
}

/** Employee "employment year" from the joining date: 1st Year, 2nd Year, ... (no cap). */
export function employmentYearFromJoining(joiningIso?: string | null, today = todayIso()): string {
  if (!isIso(joiningIso)) return '';
  return `${ordinal(fullYearsBetween(joiningIso, today) + 1)} Year`;
}

export const isEmployeeId = (empId?: string | null) => /^EMP/i.test((empId || '').trim());

const STUDENT_LEVEL = ['student', 'trainee', 'in charge', 'incharge', 'supervisor'];
/** Employee profile = anyone above student level. Uses the designation (so a promotion shows at once); the ID is only used when there is no designation. */
export const isEmployeeProfile = (empId?: string | null, designation?: string | null) => {
  const d = (designation || '').toLowerCase().trim();
  return d ? !STUDENT_LEVEL.includes(d) : isEmployeeId(empId);
};
