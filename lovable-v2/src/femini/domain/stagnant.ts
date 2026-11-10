import type { Balances, Order } from './types';
import { dayDiff } from './dates';
import { qty } from './ledger';

/**
 * Stagnant items: ready stock that nobody has asked for in STAGNANT_DAYS days or more (an item is asked for when an order with
 * it is requested, by its pickup day; a cancelled order does not count). Pure. The same rule the speed of pull is measured
 * on (the last 14 days), with the day of the last request so the detail can say how long it has been idle.
 */
export const STAGNANT_DAYS = 14;
export interface Stagnant { sku: string; ready: number; /** the last pickup day it was requested on, '' if it never was */ last: string; /** days since then, null if never */ idle: number | null }

export function stagnantSkus(skus: { id: string }[], balances: Balances, orders: Order[], pickupDate: Map<string, string>, today: string, days = STAGNANT_DAYS): Stagnant[] {
  const last: Record<string, string> = {};
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    const pd = pickupDate.get(o.pickupId); if (!pd || pd > today) continue;
    for (const s of o.lines) if (!last[s] || pd > last[s]) last[s] = pd;
  }
  const out: Stagnant[] = [];
  for (const k of skus) {
    const ready = qty(balances, k.id, 'READY'); if (ready <= 0) continue;
    const l = last[k.id] ?? ''; const idle = l ? dayDiff(l, today) : null;
    if (idle === null || idle >= days) out.push({ sku: k.id, ready, last: l, idle });
  }
  return out.sort((a, b) => b.ready - a.ready);
}
