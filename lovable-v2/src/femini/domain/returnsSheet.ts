import type { Order } from './types';

/**
 * A returns sheet (Excel / CSV from the shipping company or made by hand) in any layout: every cell is checked
 * against the orders' waybill (البوليصة) and order number, the same way the code box matches them (case, spaces and
 * # ignored). The orders found come back once each, in the sheet's order, so the return form can add them like
 * codes typed one by one. Cells that match nothing (titles, names, amounts…) are ignored. Pure.
 */
const norm = (v: unknown) => String(v ?? '').trim().replace(/[#\s]/g, '').toLowerCase();
export function returnCodesFromSheet(aoa: unknown[][], orders: Order[]): { refs: string[]; cells: number } {
  const by = new Map<string, string>();
  for (const o of orders) { by.set(o.ref.toLowerCase(), o.ref); const w = norm(o.waybill); if (w && !by.has(w)) by.set(w, o.ref); }
  const refs: string[] = []; const seen = new Set<string>(); let cells = 0;
  for (const row of aoa) for (const cell of row ?? []) {
    const c = typeof cell === 'number' ? String(Math.round(cell)) : norm(cell);
    if (!c) continue; cells++;
    const ref = by.get(c);
    if (ref && !seen.has(ref)) { seen.add(ref); refs.push(ref); }
  }
  return { refs, cells };
}
