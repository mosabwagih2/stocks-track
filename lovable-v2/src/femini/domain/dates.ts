/** Today in Cairo as YYYY-MM-DD. The work day follows this, never a typed date. */
export function cairoToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
/** The Cairo calendar day (YYYY-MM-DD) of an ISO timestamp. Never slice the ISO string: that is the UTC day. */
export const cairoDay = (iso: string): string => cairoToday(new Date(iso));
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(date + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
}
export function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5);
}
export function timeCairo(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Cairo' });
}
export function dayLabel(date: string): string {
  return new Date(date + 'T12:00:00Z').toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/**
 * How a date is shown everywhere: day-month-year (2026-11-18 → 18-11-2026). Anything that is not a date comes back as it was.
 * The date is wrapped in a left-to-right isolate: inside Arabic (right-to-left) text the browser lays the parts of "18-11-2026"
 * out from the right, so without it the same date would read 2026-11-18 on screen.
 */
const LRI = '\u2066', PDI = '\u2069';
export const dmy = (iso?: string | null): string => { const m = /^(\d{4})-(\d{2})-(\d{2})([\s\S]*)$/.exec(iso ?? ''); return m ? `${LRI}${m[3]}-${m[2]}-${m[1]}${PDI}${m[4]}` : (iso ?? ''); };
/** every yyyy-mm-dd inside a text, shown day-month-year (isolated, see dmy) */
export const dmyText = (t: string): string => t.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, `${LRI}$3-$2-$1${PDI}`);
/** the same text without the invisible isolate marks: for a file (Excel, CSV) rather than the screen */
export const plainText = (t: string): string => t.replace(/[\u2066\u2069]/g, '');
