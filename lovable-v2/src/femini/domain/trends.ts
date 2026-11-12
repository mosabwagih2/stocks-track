import type { Snapshot } from './types';
import { addDays, cairoDay } from './dates';
import { collectedOf, type Settlement } from './settle';

/**
 * Day-by-day series for the Analytics graphs. Pure: the snapshot in, rows out (one row per day, oldest first).
 *
 * Stock: the ledger is replayed to each day's closing balance, per state. Its money value uses the cost recorded for
 * each model NOW (there is no cost history), and only models with a cost count; `pieces` are every piece.
 */
export interface StockDay { day: string; ready: number; clean: number; scrap: number; lost: number; owned: number; value: number; readyValue: number }
export function stockByDay(s: Pick<Snapshot, 'moves' | 'skus' | 'archivedSkus' | 'costs'>, from: string, to: string): StockDay[] {
  const model = new Map([...s.skus, ...(s.archivedSkus ?? [])].map((k) => [k.id, k.model]));
  const cost = (sku: string) => { const c = s.costs?.[model.get(sku) ?? '']?.cost; return c && Number.isFinite(c) && c > 0 ? c : 0; };
  type Acc = { ready: number; clean: number; scrap: number; lost: number; readyValue: number; value: number };
  const zero = (): Acc => ({ ready: 0, clean: 0, scrap: 0, lost: 0, readyValue: 0, value: 0 });
  const slot = (loc: string): keyof Acc | null => (loc === 'READY' ? 'ready' : loc === 'DIRTY' || loc === 'FACTORY' ? 'clean' : loc === 'SCRAP' ? 'scrap' : loc === 'LOST' ? 'lost' : null);
  const apply = (a: Acc, loc: string, sku: string, q: number) => {
    const k = slot(loc); if (!k) return; a[k] += q;
    const v = q * cost(sku); if (k === 'ready') a.readyValue += v; if (k === 'ready' || k === 'clean') a.value += v;   // what can still be sold
  };
  const base = zero(); const delta: Record<string, Acc> = {};
  for (const m of s.moves) {
    const a = m.date < from ? base : m.date <= to ? (delta[m.date] ??= zero()) : null; if (!a) continue;
    apply(a, m.from, m.sku, -m.qty); apply(a, m.to, m.sku, m.qty);
  }
  const rows: StockDay[] = [];
  for (let k = from, cur = { ...base }; k <= to; k = addDays(k, 1)) {
    const dd = delta[k]; if (dd) for (const x of Object.keys(cur) as (keyof Acc)[]) cur[x] += dd[x];
    rows.push({ day: k, ...cur, owned: cur.ready + cur.clean + cur.scrap + cur.lost });
  }
  return rows;
}

/**
 * Collections per day: from the settlement sheets (money by the sheet's date, orders by their own collect / return
 * date) against what left with the scan (orders shipped that day). `paidSoFar` is the running total of Fémini's due.
 */
/**
 * The day each order closed by the settlement sheets: collected on the date of its collect row, or (never collected)
 * returned on the date of its first return / partial row. Each order counts once. The collections graph counts these
 * per day, and clicking a day lists the same orders.
 */
export function closedBySheet(settles: Settlement[]): Map<string, { day: string; kind: 'collected' | 'returned' }> {
  const out = new Map<string, { day: string; kind: 'collected' | 'returned' }>();
  const { collected, returned } = collectedOf(settles);
  for (const [ref, c] of collected) out.set(ref, { day: c.date, kind: 'collected' });
  for (const x of settles) for (const r of x.rows) if ((r.type === 'return' || r.type === 'partial') && returned.has(r.ref) && !out.has(r.ref)) out.set(r.ref, { day: r.date || x.date, kind: 'returned' });
  return out;
}

export interface CollectDay { day: string; shipped: number; collected: number; returned: number; /** التوريد */ due: number; paidSoFar: number }
export function collectByDay(s: Pick<Snapshot, 'orders' | 'settles'>, from: string, to: string): CollectDay[] {
  const row = (): Omit<CollectDay, 'day' | 'paidSoFar'> => ({ shipped: 0, collected: 0, returned: 0, due: 0 });
  const by: Record<string, ReturnType<typeof row>> = {}; const at = (k: string) => (k >= from && k <= to ? (by[k] ??= row()) : null);
  for (const o of s.orders) if (o.status === 'shipped' && o.shippedAt) { const r = at(cairoDay(o.shippedAt)); if (r) r.shipped++; }
  const settles = s.settles ?? []; let before = 0;
  for (const x of settles) {
    if (x.date < from) before += x.totals.due;
    const r = at(x.date); if (!r) continue;
    r.due += x.totals.due;
  }
  for (const c of closedBySheet(settles).values()) { const r = c.day ? at(c.day) : null; if (r) r[c.kind]++; }
  const out: CollectDay[] = []; let run = before;
  for (let k = from; k <= to; k = addDays(k, 1)) { const r = by[k] ?? row(); run += r.due; out.push({ day: k, ...r, paidSoFar: run }); }
  return out;
}

/**
 * The collections graph: the last `days` days up to today of ONE measure, against the same number of days right before
 * them, so the page can say whether it went up or down. `due` is Fémini's money by settlement day, `collected` is orders
 * by their collect date. `avg` is the average of the days that had any (a day with nothing would pull it down).
 */
export type CollectMetric = 'due' | 'collected';
export function collectTrend(s: Pick<Snapshot, 'orders' | 'settles'>, today: string, days: number, metric: CollectMetric) {
  const from = addDays(today, -(days - 1));
  const rows = collectByDay(s, from, today); const before = collectByDay(s, addDays(from, -days), addDays(from, -1));
  const sum = (r: CollectDay[]) => r.reduce((a, x) => a + x[metric], 0);
  const cur = sum(rows); const active = rows.filter((x) => x[metric] > 0).length;
  const avg = Math.round(cur / Math.max(1, active));
  return { rows: rows.map((x) => ({ ...x, avg })), cur, prev: sum(before), avg };
}
