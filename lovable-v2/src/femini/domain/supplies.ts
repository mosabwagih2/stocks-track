import type { Supply, SupplyEntry } from './types';
import { addDays } from './dates';

/** Supplies used by one order, from each supply's rule (flyer per order, cups per BR1 piece, packaging by size). */
export function consumption(lines: string[], supplies: Supply[], modelOf: (sku: string) => string): { item: string; qty: number }[] {
  const out: { item: string; qty: number }[] = []; const n = lines.length;
  for (const s of supplies) {
    if (s.archived) continue; const r = s.rule; let q = 0;
    if (r.kind === 'order') q = r.qty;
    else if (r.kind === 'pieces') q = r.qty * lines.filter((l) => !r.model || modelOf(l) === r.model).length;
    else if (r.kind === 'range') q = n >= r.from && (!r.to || n <= r.to) ? r.qty : 0;
    if (q > 0) out.push({ item: s.id, qty: q });
  }
  return out;
}
export const supplyBalance = (log: SupplyEntry[], id: string): number => log.reduce((a, e) => a + (e.item === id ? e.qty : 0), 0);

/** average daily use over the last N days, from automatic and manual issues (reversals subtract) */
export function dailyUse(log: SupplyEntry[], id: string, today: string, days = 7): number {
  const from = addDays(today, -(days - 1)); let u = 0;
  for (const e of log) {
    if (e.item !== id || e.date < from || e.date > today) continue;
    if (e.kind === 'auto' || e.kind === 'issue') u -= e.qty;
    // a refund tied to a document (a reversed sheet, or a cancelled order whose stock came back) was not really used
    else if (e.kind === 'rev' && e.qty > 0 && e.doc) u -= e.qty;
  }
  return Math.max(0, u) / days;
}
export type SupplyStatus = 'crit' | 'warn' | 'good';
export function supplyStatus(s: Supply, bal: number, use: number): SupplyStatus {
  const cover = use > 0 ? bal / use : null;
  if (bal <= 0) return 'crit';
  if ((s.minAlert && bal < s.minAlert) || (cover !== null && cover < 7)) return 'warn';
  return 'good';
}
