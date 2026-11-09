import { describe, expect, it } from 'vitest';
import { collectByDay, stockByDay } from './trends';
import type { Move, Order, Sku } from './types';
import type { Settlement } from './settle';

const mv = (date: string, sku: string, qty: number, from: string, to: string) => ({ date, sku, qty, from, to }) as unknown as Move;
const skus = [{ id: 'a', model: 'SH2', color: 'x', size: 'M' }, { id: 'b', model: 'BR2', color: 'x', size: 'M' }] as Sku[];

describe('stock by day', () => {
  it('replays the ledger to each day; value only for models with a cost', () => {
    const moves = [mv('2026-11-01', 'a', 10, 'EXT_OPEN', 'READY'), mv('2026-11-01', 'b', 5, 'EXT_OPEN', 'READY'), mv('2026-11-03', 'a', 2, 'READY', 'DIRTY'), mv('2026-11-03', 'b', 1, 'READY', 'EXT_CH'), mv('2026-11-04', 'a', 1, 'DIRTY', 'SCRAP')];
    const r = stockByDay({ moves, skus, archivedSkus: [], costs: { SH2: { cost: 50, price: 0 } } as never }, '2026-11-02', '2026-11-04');
    expect(r.map((x) => [x.day, x.ready, x.clean, x.scrap, x.owned, x.readyValue, x.value])).toEqual([
      ['2026-11-02', 15, 0, 0, 15, 500, 500],
      ['2026-11-03', 12, 2, 0, 14, 400, 500],   // BR2 has no cost: its pieces count, its value does not
      ['2026-11-04', 12, 1, 1, 14, 400, 450],
    ]);
  });
});

describe('collections by day', () => {
  it('orders shipped / collected / returned per day, money per settlement day, Fémini due adding up', () => {
    const o = (ref: string, at: string) => ({ ref, status: 'shipped', shippedAt: at, lines: [], unmapped: [] }) as unknown as Order;
    const st = (id: string, date: string, due: number, rows: [string, string, string][]) => ({ id, date, totals: { sales: due * 2, cod: due * 2 - 10, shipping: 10, due, vendoor: due - 10 }, rows: rows.map(([ref, type, d]) => ({ ref, type, date: d, cod: 0, supply: 0 })) }) as unknown as Settlement;
    const r = collectByDay({ orders: [o('x1', '2026-11-01T10:00:00Z'), o('x2', '2026-11-01T11:00:00Z'), o('x3', '2026-11-02T10:00:00Z')],
      settles: [st('S0', '2026-10-30', 100, []), st('S1', '2026-11-02', 300, [['x1', 'collect', '2026-11-02'], ['x2', 'return', '2026-11-01']])] }, '2026-11-01', '2026-11-02');
    expect(r.map((x) => [x.day, x.shipped, x.collected, x.returned, x.due, x.paidSoFar])).toEqual([['2026-11-01', 2, 0, 1, 0, 100], ['2026-11-02', 1, 1, 0, 300, 400]]);
  });
});
