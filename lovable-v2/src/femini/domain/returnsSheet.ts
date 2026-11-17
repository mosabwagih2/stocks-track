import type { Order } from './types';

/**
 * A returns sheet (Excel / CSV from the shipping company or made by hand) in any layout: every cell is checked
 * against the orders' waybill (البوليصة) and order number, the same way the code box matches them (case, spaces and
 * # ignored). The orders found come back once each, in the sheet's order, so the return form can add them like
 * codes typed one by one. Cells that match nothing (titles, names, amounts…) are ignored.
 *
 * The courier's report mixes the two kinds of rows in one file: `collect` (delivered, the money came) and `return`.
 * When the sheet has a Type column («Type» / «النوع»), ONLY the return rows are read: a collect row is not a return,
 * and adding it would put a delivered order back into the stock. Without a Type column every row counts, as before.
 * Return rows that match no order come back in `missing` (their serial), so the form can say why nothing was added
 * (typically: orders from before the system started, or whose pickup was never uploaded). Pure.
 */
export interface ReturnsSheet {
  /** orders found, once each, in the sheet's order */
  refs: string[];
  /** non-empty cells read */
  cells: number;
  /** the sheet has a Type column: how many rows are returns, and how many other rows (collect…) were skipped */
  returnRows: number; skippedRows: number;
  /** return rows that match no order (their serial / waybill as written) */
  missing: string[];
}

const norm = (v: unknown) => String(v ?? '').trim().replace(/[#\s]/g, '').toLowerCase();
const key = (cell: unknown) => (typeof cell === 'number' ? String(Math.round(cell)) : norm(cell));
const TYPE_HEAD = new Set(['type', 'النوع', 'نوعالحركة']);
const SERIAL_HEAD = new Set(['serial', 'waybill', 'البوليصة', 'بوليصة', 'رقمالبوليصة']);
const RETURN_VAL = new Set(['return', 'returned', 'مرتجع', 'راجع', 'مرتجعات']);

export function returnCodesFromSheet(aoa: unknown[][], orders: Order[]): ReturnsSheet {
  const by = new Map<string, string>();
  for (const o of orders) { by.set(o.ref.toLowerCase(), o.ref); const w = norm(o.waybill); if (w && !by.has(w)) by.set(w, o.ref); }
  const refs: string[] = []; const seen = new Set<string>(); const missing: string[] = []; let cells = 0, returnRows = 0, skippedRows = 0;
  let typeCol = -1, serialCol = -1; // set by a header row; a later header (another sheet) resets them
  for (const row of aoa) {
    const r = row ?? [];
    const head = r.findIndex((c) => TYPE_HEAD.has(norm(c)));
    if (head >= 0 && r.some((c, i) => i !== head && SERIAL_HEAD.has(norm(c)))) { typeCol = head; serialCol = r.findIndex((c) => SERIAL_HEAD.has(norm(c))); continue; }
    const filtered = typeCol >= 0;
    if (filtered && !RETURN_VAL.has(norm(r[typeCol]))) { if (r.some((c) => norm(c))) skippedRows++; continue; }
    if (filtered) returnRows++;
    let hit = false;
    for (const cell of r) {
      const c = key(cell);
      if (!c) continue; cells++;
      const ref = by.get(c);
      if (ref) { hit = true; if (!seen.has(ref)) { seen.add(ref); refs.push(ref); } }
    }
    if (filtered && !hit) missing.push(serialCol >= 0 && key(r[serialCol]) ? key(r[serialCol]) : r.map(key).find(Boolean) ?? '?');
  }
  return { refs, cells, returnRows, skippedRows, missing };
}
