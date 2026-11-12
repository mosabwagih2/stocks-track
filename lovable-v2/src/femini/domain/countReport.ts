import type { Doc, Snapshot } from './types';
import { costOf } from './shop';

/**
 * «تقرير الجرد»: every count (CNT) in the dates, item by item. What the system had when counting started (`system`,
 * the document's snap), what was counted (`counted`), and the change that was posted (`diff`, from the ledger moves:
 * EXT_ADJ → state is more, state → EXT_ADJ is less). The posted change is the truth: if the balance moved while
 * counting, the difference is taken from the balance at posting (the form asks to agree to that).
 * Money is at the cost recorded now. Reversed counts are left out. Pure.
 */
export interface CountLine { sku: string; system: number | null; counted: number | null; diff: number }
export interface CountDoc {
  doc: Doc; state: string;
  /** items counted */ items: number; matched: number;
  more: { items: number; pieces: number; value: number }; less: { items: number; pieces: number; value: number };
  lines: CountLine[];
}
type S = Pick<Snapshot, 'skus' | 'archivedSkus' | 'costs' | 'moves' | 'docs'>;
const bucket = () => ({ items: 0, pieces: 0, value: 0 });

export function countReport(s: S, from: string, to: string) {
  const cost = costOf(s);
  const docs = s.docs.filter((x) => x.type === 'CNT' && x.status !== 'reversed' && x.date >= from && x.date <= to);
  const want = new Set(docs.map((x) => x.no));
  const diffs = new Map<string, Map<string, number>>();
  for (const m of s.moves) {
    if (m.type !== 'CNT' || !want.has(m.doc)) continue;
    const d = diffs.get(m.doc) ?? new Map<string, number>();
    const q = m.from === 'EXT_ADJ' ? m.qty : m.to === 'EXT_ADJ' ? -m.qty : 0;
    d.set(m.sku, (d.get(m.sku) ?? 0) + q); diffs.set(m.doc, d);
  }
  const out: CountDoc[] = docs.map((doc) => {
    const cnt = (doc.hdr.cnt ?? {}) as Record<string, number>; const snap = (doc.hdr.snap ?? {}) as Record<string, number>;
    const posted = diffs.get(doc.no) ?? new Map<string, number>();
    const skus = new Set([...Object.keys(cnt), ...posted.keys()]);
    const lines: CountLine[] = [...skus].map((sku) => ({ sku, system: sku in snap ? Number(snap[sku]) : null, counted: sku in cnt ? Number(cnt[sku]) : null, diff: posted.get(sku) ?? 0 }));
    const more = bucket(), less = bucket(); let matched = 0;
    for (const l of lines) {
      if (l.diff > 0) { more.items++; more.pieces += l.diff; more.value += l.diff * cost(l.sku); }
      else if (l.diff < 0) { less.items++; less.pieces -= l.diff; less.value -= l.diff * cost(l.sku); }
      else matched++;
    }
    // the biggest changes first: shortages, then increases, then what matched
    lines.sort((a, b) => (a.diff < 0 ? 0 : a.diff > 0 ? 1 : 2) - (b.diff < 0 ? 0 : b.diff > 0 ? 1 : 2) || Math.abs(b.diff) - Math.abs(a.diff) || a.sku.localeCompare(b.sku));
    return { doc, state: String(doc.hdr.state ?? 'READY'), items: lines.length, matched, more, less, lines };
  }).sort((a, b) => b.doc.date.localeCompare(a.doc.date) || b.doc.no.localeCompare(a.doc.no));

  // across the counts: each item's total change, and per model
  const bySku = new Map<string, { more: number; less: number; counts: number }>();
  for (const c of out) for (const l of c.lines) { const e = bySku.get(l.sku) ?? { more: 0, less: 0, counts: 0 }; e.counts++; if (l.diff > 0) e.more += l.diff; else e.less -= l.diff; bySku.set(l.sku, e); }
  const model = new Map([...s.skus, ...(s.archivedSkus ?? [])].map((k) => [k.id, k.model]));
  const byModel: Record<string, { items: number; more: number; less: number; value: number }> = {};
  for (const [sku, e] of bySku) {
    const m = model.get(sku) ?? '—'; const x = (byModel[m] ??= { items: 0, more: 0, less: 0, value: 0 });
    x.items++; x.more += e.more; x.less += e.less; x.value += (e.more - e.less) * cost(sku);
  }
  const sum = (k: 'more' | 'less') => out.reduce((a, c) => ({ items: a.items + c[k].items, pieces: a.pieces + c[k].pieces, value: a.value + c[k].value }), bucket());
  const items = out.reduce((a, c) => a + c.items, 0); const matched = out.reduce((a, c) => a + c.matched, 0);
  return { counts: out, more: sum('more'), less: sum('less'), items, matched, bySku, byModel };
}
