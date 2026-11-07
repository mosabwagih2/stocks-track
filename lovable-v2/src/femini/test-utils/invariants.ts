// The rules that must always hold in the stock system, checked on a snapshot. Shared by the integration tests.
import { LOCS } from '@/femini/domain/constants';
import { qty } from '@/femini/domain/ledger';
import { consumption } from '@/femini/domain/supplies';
import { outstanding } from '@/femini/domain/holds';
import type { Order, Snapshot } from '@/femini/domain/types';

export function violations(s: Snapshot): string[] {
  const out: string[] = []; const b = s.balances;
  const docStatus = new Map(s.docs.map((d) => [d.no, d.status]));
  const allOrders: Order[] = [...s.orders, ...s.archivedPickups.flatMap((a) => a.orders)];
  const skuModel = new Map([...s.skus, ...s.archivedSkus].map((k) => [k.id, k.model]));
  const net = (loc: string) => { const n: Record<string, number> = {}; for (const m of s.moves) { if (m.to === loc) n[m.sku] = (n[m.sku] ?? 0) + m.qty; if (m.from === loc) n[m.sku] = (n[m.sku] ?? 0) - m.qty; } return n; };

  // 1. no warehouse state below zero
  for (const sku of Object.keys(b)) for (const l of LOCS) if (qty(b, sku, l) < 0) out.push(`negative ${l}`);
  // 2. document numbers are unique
  const nos = s.docs.map((d) => d.no); if (new Set(nos).size !== nos.length) out.push('duplicate document number');
  // 3. pieces with the channel = pieces of orders whose shipment stands and did not come back
  // a customer return proves the order really left, so it keeps its shipment even if the sheet is reversed later (by design)
  const stands = (o: Order) => !!o.shipDoc && (docStatus.get(o.shipDoc) === 'done' || !!o.returned);
  const exp: Record<string, number> = {};
  for (const o of allOrders) {
    const atCustomer = (o.status === 'shipped' && !o.returned) || (o.status === 'cancelled' && o.cancel?.was === 'shipped' && !o.cancel.returned && !o.returned && stands(o));
    if (atCustomer) for (const l of o.lines) exp[l] = (exp[l] ?? 0) + 1;
  }
  const ch = net('EXT_CH');
  for (const sku of new Set([...Object.keys(exp), ...Object.keys(ch)])) if ((exp[sku] ?? 0) !== (ch[sku] ?? 0)) { out.push('channel pieces do not match orders'); break; }
  // 4. order states agree with their documents
  for (const o of allOrders) {
    if (o.status === 'shipped' && !stands(o)) out.push('shipped order without a valid shipment sheet');
    if (o.status === 'open' && o.shipDoc) out.push('open order still linked to a shipment sheet');
  }
  // 5. pieces out on hold = what open holds say is outside
  const held = net('EXT_HOLD'); const outH: Record<string, number> = {};
  for (const h of s.holds) { const o = outstanding(h); if (h.status === 'closed' && Object.keys(o).length) out.push('closed hold still has pieces outside'); for (const k in o) outH[k] = (outH[k] ?? 0) + o[k]; }
  for (const sku of new Set([...Object.keys(held), ...Object.keys(outH)])) if ((held[sku] ?? 0) !== (outH[sku] ?? 0)) { out.push('hold pieces do not match hold records'); break; }
  // 6. packaging used = packaging of every order whose shipment stands (refunded when the stock came back by cancellation)
  const want: Record<string, number> = {};
  for (const o of allOrders) {
    if (!stands(o)) continue;
    if (o.status === 'cancelled' && o.cancel?.returned && !o.returned) continue;
    for (const c of consumption(o.lines, s.supplies, (x) => skuModel.get(x) ?? '')) want[c.item] = (want[c.item] ?? 0) + c.qty;
  }
  const got: Record<string, number> = {}; for (const e of s.supplyLog) if (e.doc) got[e.item] = (got[e.item] ?? 0) - e.qty;
  for (const k of new Set([...Object.keys(want), ...Object.keys(got)])) if ((want[k] ?? 0) !== (got[k] ?? 0)) { out.push('supplies used do not match shipped orders'); break; }
  // 7. a removed variant has nothing left anywhere
  for (const k of s.archivedSkus) if (LOCS.some((l) => qty(b, k.id, l) !== 0) || (held[k.id] ?? 0) > 0 || s.orders.some((o) => o.status === 'open' && o.lines.includes(k.id))) { out.push('removed variant still has stock, hold or demand'); break; }
  // 8. nothing posted into a closed day after it was closed
  for (const c of s.closes) if (c.status === 'closed' && s.moves.some((m) => m.date === c.date && m.ts > c.at)) out.push('movement posted into a closed day');
  return [...new Set(out)];
}

