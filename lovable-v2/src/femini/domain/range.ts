import { addDays } from './dates';

/**
 * The analytics period: a window of Cairo days, both ends included. Pure: naming a window, the ready-made ones,
 * and stepping to the window before / after it. A whole calendar month steps by months; any other window steps by
 * its own length. Nothing goes past today.
 */
export interface Range { from: string; to: string }

export const rangeLen = (r: Range) => Math.round((Date.parse(r.to) - Date.parse(r.from)) / 864e5) + 1;

const at = (day: string) => new Date(day + 'T12:00:00Z');
const fmt = (day: string, o: Intl.DateTimeFormatOptions) => at(day).toLocaleDateString('ar-EG-u-nu-latn', { timeZone: 'UTC', ...o });
const monthStart = (day: string) => day.slice(0, 8) + '01';
const monthEnd = (day: string) => addDays(addMonths(monthStart(day), 1), -1);
export function addMonths(day: string, n: number): string {
  const d = at(monthStart(day)); d.setUTCMonth(d.getUTCMonth() + n); return d.toISOString().slice(0, 10);
}

/** «يوم / يومين / 3 أيام / 11 يوم» */
export function daysAr(n: number): string {
  if (n === 1) return 'يوم'; if (n === 2) return 'يومين';
  return n <= 10 ? `${n} أيام` : `${n} يوم`;
}

/** a whole calendar month, or this month from its 1st up to today */
export function monthOf(r: Range, today: string): boolean {
  if (r.from !== monthStart(r.from) || r.to.slice(0, 7) !== r.from.slice(0, 7)) return false;
  return r.to === monthEnd(r.from) || (r.to === today && today.slice(0, 7) === r.from.slice(0, 7));
}

const clamp = (r: Range, today: string): Range => (r.to > today ? { from: r.from > today ? today : r.from, to: today } : r);

/** the window right before (-1) or right after (+1) this one */
export function shiftRange(r: Range, dir: 1 | -1, today: string): Range {
  if (monthOf(r, today)) {
    const from = addMonths(r.from, dir);
    return clamp({ from, to: monthEnd(from) }, today);
  }
  const n = rangeLen(r);
  if (dir === -1) return { from: addDays(r.from, -n), to: addDays(r.from, -1) };
  let to = addDays(r.to, n); if (to > today) to = today;
  return { from: addDays(to, -(n - 1)), to };
}

export const canStepForward = (r: Range, today: string) => r.to < today;

export interface Preset { id: string; label: string; range: Range }
export function presets(today: string): Preset[] {
  const last = (n: number): Range => ({ from: addDays(today, -(n - 1)), to: today });
  const prevMonth = addMonths(today, -1);
  return [
    { id: 'today', label: 'النهارده', range: last(1) },
    { id: 'yesterday', label: 'امبارح', range: { from: addDays(today, -1), to: addDays(today, -1) } },
    { id: '7', label: 'آخر 7 أيام', range: last(7) },
    { id: '14', label: 'آخر 14 يوم', range: last(14) },
    { id: '30', label: 'آخر 30 يوم', range: last(30) },
    { id: 'month', label: 'الشهر ده', range: { from: monthStart(today), to: today } },
    { id: 'lastMonth', label: 'الشهر اللي فات', range: { from: prevMonth, to: monthEnd(prevMonth) } },
  ];
}

export const sameRange = (a: Range, b: Range) => a.from === b.from && a.to === b.to;

/** A short name for the window («آخر 7 أيام», «أكتوبر 2026», «31 أكتوبر – 5 نوفمبر») and how many days it has. */
export function describeRange(r: Range, today: string): { title: string; days: string } {
  const n = rangeLen(r); const days = daysAr(n);
  const p = presets(today).find((x) => sameRange(x.range, r) && x.id !== 'lastMonth');
  if (p) return { title: p.label, days };
  const year = (day: string) => (day.slice(0, 4) === today.slice(0, 4) ? {} : { year: 'numeric' as const });
  if (n === 1) return { title: fmt(r.from, { weekday: 'long', day: 'numeric', month: 'long', ...year(r.from) }), days };
  if (monthOf(r, today)) return { title: fmt(r.from, { month: 'long', year: 'numeric' }), days };
  if (r.to === today) return { title: `آخر ${daysAr(n)}`, days: `من ${fmt(r.from, { day: 'numeric', month: 'long' })}` };
  const sameMonth = r.from.slice(0, 7) === r.to.slice(0, 7);
  const a = sameMonth ? fmt(r.from, { day: 'numeric' }) : fmt(r.from, { day: 'numeric', month: 'long', ...year(r.from) });
  return { title: `${a} – ${fmt(r.to, { day: 'numeric', month: 'long', ...year(r.to) })}`, days };
}

/** The days of a month as calendar weeks starting Saturday; '' fills the cells before the 1st and after the end. */
export function monthGrid(month: string): string[][] {
  const first = monthStart(month); const last = monthEnd(month);
  const lead = (at(first).getUTCDay() + 1) % 7;   // Saturday = 0
  const cells: string[] = Array(lead).fill('');
  for (let d = first; d <= last; d = addDays(d, 1)) cells.push(d);
  while (cells.length % 7) cells.push('');
  const weeks: string[][] = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
export const monthTitle = (month: string) => fmt(monthStart(month), { month: 'long', year: 'numeric' });
