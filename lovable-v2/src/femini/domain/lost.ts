import type { Doc, Move, Order } from './types';

/** One returned order with pieces that did not come back. */
export interface LostOrder {
  ref: string;              // البوليصة (the order code)
  orderNo: string;          // رقم الأوردر
  doc: string; date: string; by: string;
  /** every piece of the parcel; `missing` marks the ones that did not come back */
  items: { sku: string; missing: boolean; settled?: boolean }[];
  /** the return only kept totals and more than one of its orders had this sku: the piece is one of them */
  shared?: string[];
}

type Parcel = { ref?: string; wb?: string; items?: { sku: string; st?: string }[] };
const clean = (r: string) => r.replace(/^man:/, '');

/**
 * Orders with lost pieces, oldest first, from the customer-return documents:
 *  - returns from the original app keep each parcel (waybill) with its pieces; a missing one is marked "m"
 *  - returns from this app keep per-sku totals and the list of orders: a missing piece is put on the order that has that sku;
 *    when several orders of the same return have it, it is shown on each with `shared` (never guessed)
 *  - lost moves of a correction document name the order in their note ("… · xk6669")
 * Settled pieces (found or written off later) are marked oldest first, per sku.
 */
export function lostOrders(docs: Doc[], orders: Order[], moves: Move[]): LostOrder[] {
  const byRef = new Map(orders.map((o) => [o.ref, o]));
  const out: LostOrder[] = []; const covered = new Map<string, number>();   // lost pieces explained per doc
  for (const d of docs) {
    if (d.type !== 'RTN' || d.status !== 'done') continue;
    const parcels = (d.hdr.parcels as Parcel[] | undefined) ?? null;
    if (parcels) {
      for (const p of parcels) {
        const items = (p.items ?? []).map((i) => ({ sku: i.sku, missing: i.st === 'm' }));
        const n = items.filter((i) => i.missing).length; if (!n) continue;
        const ref = clean(String(p.ref ?? '')); const o = byRef.get(ref);
        out.push({ ref, orderNo: String(p.wb && p.wb !== ref ? p.wb : o?.waybill ?? ''), doc: d.no, date: d.date, by: d.by, items });
        covered.set(d.no, (covered.get(d.no) ?? 0) + n);
      }
      continue;
    }
    const short: Record<string, number> = {};
    for (const l of d.lines as unknown as { sku: string; exp?: number; r?: number; d?: number; x?: number }[]) {
      const got = (Number(l.r) || 0) + (Number(l.d) || 0) + (Number(l.x) || 0); const exp = Number(l.exp) || 0;
      if (exp > got) short[l.sku] = (short[l.sku] ?? 0) + exp - got;
    }
    if (!Object.keys(short).length) continue;
    const refs = ((d.hdr.refs as string[] | undefined) ?? []).map(clean).filter((r) => byRef.has(r));
    const rows = new Map<string, LostOrder>();
    for (const [sku, q] of Object.entries(short)) {
      const has = refs.filter((r) => byRef.get(r)!.lines.includes(sku));
      for (const r of has.length ? has : refs.slice(0, 1)) {
        const o = byRef.get(r)!;
        const row: LostOrder = rows.get(r) ?? { ref: r, orderNo: o.waybill, doc: d.no, date: d.date, by: d.by, items: o.lines.map((s) => ({ sku: s, missing: false })) };
        // mark q pieces of this sku as missing on this order (as many as it has)
        let left = Math.min(q, row.items.filter((i) => i.sku === sku).length || q);
        for (const i of row.items) if (left > 0 && i.sku === sku && !i.missing) { i.missing = true; left--; }
        if (left > 0) for (; left > 0; left--) row.items.push({ sku, missing: true });
        if (has.length > 1) row.shared = has.filter((x) => x !== r);
        rows.set(r, row);
      }
      covered.set(d.no, (covered.get(d.no) ?? 0) + q);
    }
    out.push(...rows.values());
  }
  // lost moves no return explains (e.g. a correction): the note names the order
  const extra = new Map<string, Move[]>();
  for (const m of moves) if (m.to === 'LOST') extra.set(m.doc, [...(extra.get(m.doc) ?? []), m]);
  for (const [doc, ms] of extra) {
    let left = ms.reduce((a, m) => a + m.qty, 0) - (covered.get(doc) ?? 0); if (left <= 0) continue;
    for (const m of ms) {
      if (left <= 0) break;
      const ref = /·\s*(\S+)\s*$/.exec(m.note)?.[1] ?? ''; const o = byRef.get(ref);
      const q = Math.min(m.qty, left); left -= q;
      out.push({ ref: o ? ref : '', orderNo: o?.waybill ?? '', doc, date: m.date, by: m.by, items: Array.from({ length: q }, () => ({ sku: m.sku, missing: true })) });
    }
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.doc.localeCompare(b.doc));
  // settlements (LOST → found / written off) close the oldest missing pieces of the same sku first
  const settled: Record<string, number> = {}; for (const m of moves) if (m.from === 'LOST') settled[m.sku] = (settled[m.sku] ?? 0) + m.qty;
  for (const r of out) for (const i of r.items) if (i.missing && (settled[i.sku] ?? 0) > 0) { i.settled = true; settled[i.sku]--; }
  return out;
}
