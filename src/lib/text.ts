/** Capitalise the first letter of every word ("free school street,kathal bagan" -> "Free School Street, Kathal Bagan"). */
export function titleCaseWords(value: string): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim()
    .replace(/(^|[\s(\-/.])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}
