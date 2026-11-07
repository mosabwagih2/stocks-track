import type { Balances, Order, Pickup, Sku } from './types';
import { qty } from './ledger';

export interface Missing { sku: string; short: number }

/** pieces per SKU in an order */
export function need(order: Pick<Order, 'lines'>): Record<string, number> {
  const n: Record<string, number> = {};
  for (const s of order.lines) n[s] = (n[s] ?? 0) + 1;
  return n;
}

/**
 * Which open orders will be stuck? READY stock is allocated order by order (oldest pickup first).
 * An order is stuck when ANY of its variants is short, because the bundle ships complete.
 * Stuck orders do not consume stock, so later orders can still be served.
 */
export function allocate(openOrders: Order[], pickups: Pickup[], balances: Balances): { blocked: Map<string, Missing[]>; demand: Record<string, number> } {
  const idx = new Map(pickups.map((p, i) => [p.id, i]));
  const sorted = [...openOrders].sort((a, b) => (idx.get(a.pickupId) ?? 0) - (idx.get(b.pickupId) ?? 0));
  const rem: Record<string, number> = {};
  const ready = (s: string) => (s in rem ? rem[s] : (rem[s] = qty(balances, s, 'READY')));
  const blocked = new Map<string, Missing[]>();
  const demand: Record<string, number> = {};
  for (const o of sorted) {
    const n = need(o);
    for (const s in n) demand[s] = (demand[s] ?? 0) + n[s];
    const miss = Object.keys(n).filter((s) => ready(s) < n[s]);
    if (miss.length) blocked.set(o.ref, miss.map((s) => ({ sku: s, short: n[s] - Math.max(0, ready(s)) })));
    else for (const s in n) rem[s] -= n[s];
  }
  return { blocked, demand };
}

export function skuLabel(skus: Map<string, Sku>, id: string, withModel = true): string {
  const k = skus.get(id);
  return k ? (withModel ? `${k.model} · ` : '') + `${k.color} · ${k.size}` : id;
}

/** match by order code (what the QR holds) or by the shipping number; ignores the # printed on labels */
export function findByCode(orders: Order[], code: string): Order | undefined {
  const c = code.trim().replace(/[#\s]/g, '').toLowerCase();
  if (!c) return undefined;
  return orders.find((o) => o.ref.toLowerCase() === c || o.waybill.replace(/\s/g, '').toLowerCase() === c);
}
