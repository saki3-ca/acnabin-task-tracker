export function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function toInputDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function todayInputDate(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function daysUntilDeadline(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const deadline = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  if (isNaN(deadline.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((deadline.getTime() - today.getTime()) / 86400000);
}

export function isOverdue(deadline?: string | null, status?: string): boolean {
  if (!deadline || status === 'Completed') return false;
  const days = daysUntilDeadline(deadline);
  return days !== null && days < 0;
}

export function isNearDeadline(deadline?: string | null, status?: string): boolean {
  if (!deadline || status === 'Completed') return false;
  const days = daysUntilDeadline(deadline);
  return days !== null && days >= 0 && days <= 3;
}
