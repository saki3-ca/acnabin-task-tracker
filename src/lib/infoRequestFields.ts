/** The pieces of personal/work information the Admin can ask people to update from a notification. */
export type InfoField = 'client' | 'salary' | 'conveyance' | 'academicYear' | 'bloodGroup' | 'emergency';

export const INFO_FIELDS: { key: InfoField; label: string; hint: string }[] = [
  { key: 'client', label: 'Client(s)', hint: 'Which clients they work on (the first is the Primary client)' },
  { key: 'salary', label: 'Monthly salary / allowance', hint: 'Shows their current value' },
  { key: 'conveyance', label: 'Daily conveyance', hint: 'Shows their current value' },
  { key: 'academicYear', label: 'Academic year', hint: 'Only asked from students and trainees' },
  { key: 'bloodGroup', label: 'Blood group', hint: '' },
  { key: 'emergency', label: 'Emergency contact', hint: 'Name and mobile number' }
];

export const ALL_INFO_FIELDS: InfoField[] = INFO_FIELDS.map(f => f.key);

const VALID = new Set<string>(ALL_INFO_FIELDS);

/** Which fields a stored notification asks for. Older requests (before field choice) map to their old sets. */
export function fieldsOfRequest(data?: { kind?: string; fields?: unknown } | null): InfoField[] {
  if (data?.kind === 'SALARY_INFO') return ['salary', 'conveyance'];
  if (Array.isArray(data?.fields)) {
    const list = (data!.fields as unknown[]).filter((f): f is InfoField => typeof f === 'string' && VALID.has(f));
    if (list.length > 0) return list;
  }
  // the original "update your information" request
  return ['academicYear', 'salary', 'conveyance', 'bloodGroup', 'emergency'];
}

export const describeFields = (fields: InfoField[]): string =>
  INFO_FIELDS.filter(f => fields.includes(f.key)).map(f => f.label.toLowerCase()).join(', ');
