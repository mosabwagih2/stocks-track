import type { Doc, Snapshot } from './types';
import { addDays } from './dates';

/**
 * Money and pieces of things that left the stock in a period, valued at the cost recorded NOW for each model (there is
 * no cost history). A model with no cost counts its pieces, not its value (`noCost` says how many such pieces). Pure.
 */
type S = Pick<Snapshot, 'skus' | 'archivedSkus' | 'costs'>;
export function costOf(s: S) {
  const model = new Map([...s.skus, ...(s.archivedSkus ?? [])].map((k) => [k.id, k.model]));
  return (sku: string) => { const c = s.costs?.[model.get(sku) ?? '']?.cost; return c && Number.isFinite(c) && c > 0 ? c : 0; };
}
export interface Valued { pieces: number; value: number; noCost: number }
const zero = (): Valued => ({ pieces: 0, value: 0, noCost: 0 });
const addTo = (v: Valued, q: number, c: number) => { v.pieces += q; v.value += q * c; if (!c) v.noCost += q; };

/**
 * Lost pieces decided in the period (by the move's date): settled (paid for, LOST → EXT_COMP, counted in money at cost)
 * and lost for good (LOST → EXT_OFF).
 */
export function lostSettlement(s: S & Pick<Snapshot, 'moves'>, from: string, to: string): { comp: Valued; off: Valued } {
  const cost = costOf(s); const comp = zero(), off = zero();
  for (const m of s.moves) {
    if (m.from !== 'LOST' || m.date < from || m.date > to) continue;
    if (m.to === 'EXT_COMP') addTo(comp, m.qty, cost(m.sku)); else if (m.to === 'EXT_OFF') addTo(off, m.qty, cost(m.sku));
  }
  return { comp, off };
}

/** One shop supply (SHP) or shop return (SRT) document, valued at cost. */
export interface ShopDoc { doc: Doc; kind: 'out' | 'back'; shop: string; pieces: number; value: number; noCost: number; /** for a return: pieces per state it came back in */ states: Record<string, number> }
export interface ShopDay { day: string; out: number; back: number; outValue: number; backValue: number }

/**
 * «توريد المحل»: what went to the shop (SHP, READY → EXT_SHOP) and what came back (SRT, EXT_SHOP → READY / DIRTY /
 * SCRAP), from the ledger. Reversed documents are left out. `atShop` is what is at the shop now (all time, out − back).
 */
export function shopFlow(s: S & Pick<Snapshot, 'moves' | 'docs'>, from: string, to: string) {
  const cost = costOf(s);
  const byDoc = new Map<string, ShopDoc>();
  const atShop = zero(); const shops: Record<string, { out: number; back: number; outValue: number; backValue: number }> = {};
  const docMap = new Map(s.docs.map((x) => [x.no, x]));
  for (const m of s.moves) {
    const out = m.from === 'READY' && m.to === 'EXT_SHOP'; const back = m.from === 'EXT_SHOP';
    if (!out && !back) continue;
    const doc = docMap.get(m.doc); if (!doc || doc.status === 'reversed') continue;
    const c = cost(m.sku); const shop = String(doc.hdr.shop ?? '') || 'بدون اسم';
    const sh = (shops[shop] ??= { out: 0, back: 0, outValue: 0, backValue: 0 });
    if (out) { sh.out += m.qty; sh.outValue += m.qty * c; addTo(atShop, m.qty, c); } else { sh.back += m.qty; sh.backValue += m.qty * c; atShop.pieces -= m.qty; atShop.value -= m.qty * c; }
    if (doc.date < from || doc.date > to) continue;   // a document counts on its own date, as its card and the graph show it
    const e = byDoc.get(doc.no) ?? { doc, kind: out ? 'out' : 'back', shop, pieces: 0, value: 0, noCost: 0, states: {} };
    e.pieces += m.qty; e.value += m.qty * c; if (!c) e.noCost += m.qty;
    if (back) e.states[m.to] = (e.states[m.to] ?? 0) + m.qty;
    byDoc.set(doc.no, e);
  }
  const docs = [...byDoc.values()].sort((a, b) => b.doc.date.localeCompare(a.doc.date) || b.doc.no.localeCompare(a.doc.no));
  const days: ShopDay[] = [];
  for (let k = from; k <= to; k = addDays(k, 1)) days.push({ day: k, out: 0, back: 0, outValue: 0, backValue: 0 });
  const at = new Map(days.map((x) => [x.day, x]));
  for (const x of docs) { const r = at.get(x.doc.date); if (!r) continue; if (x.kind === 'out') { r.out += x.pieces; r.outValue += x.value; } else { r.back += x.pieces; r.backValue += x.value; } }
  const sum = (k: 'out' | 'back') => docs.filter((x) => x.kind === k).reduce((a, x) => ({ n: a.n + 1, pieces: a.pieces + x.pieces, value: a.value + x.value, noCost: a.noCost + x.noCost }), { n: 0, pieces: 0, value: 0, noCost: 0 });
  return { docs, days, out: sum('out'), back: sum('back'), atShop, shops };
}

/**
 * What the shop took, item by item, in the dates (the same documents as shopFlow: by the document's date, reversed
 * ones left out): pieces out and back per variant, and the state the returns came back in.
 */
export function shopMix(s: Pick<Snapshot, 'moves' | 'docs'>, from: string, to: string) {
  const docMap = new Map(s.docs.map((x) => [x.no, x]));
  const bySku = new Map<string, { out: number; back: number }>(); const backTo: Record<string, number> = {};
  for (const m of s.moves) {
    const out = m.from === 'READY' && m.to === 'EXT_SHOP'; const back = m.from === 'EXT_SHOP';
    if (!out && !back) continue;
    const doc = docMap.get(m.doc); if (!doc || doc.status === 'reversed' || doc.date < from || doc.date > to) continue;
    const e = bySku.get(m.sku) ?? { out: 0, back: 0 };
    if (out) e.out += m.qty; else { e.back += m.qty; backTo[m.to] = (backTo[m.to] ?? 0) + m.qty; }
    bySku.set(m.sku, e);
  }
  return { bySku, backTo };
}
