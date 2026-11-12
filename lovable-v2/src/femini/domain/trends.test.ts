import { describe, expect, it } from 'vitest';
import { closedBySheet, collectByDay, collectTrend, collectTrendRange, stockByDay } from './trends';
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

describe('orders closed by the sheets, per day', () => {
  it('each order once: collected on its collect date, else returned on its first return row; the graph counts the same orders', () => {
    const st = (id: string, date: string, rows: [string, string, string?][]) => ({ id, date, totals: { due: 0 }, rows: rows.map(([ref, type, d]) => ({ ref, type, date: d ?? date, supply: 10 })) }) as unknown as Settlement;
    const settles = [st('S1', '2026-11-02', [['a', 'collect'], ['b', 'return', '2026-11-01'], ['c', 'partial']]), st('S2', '2026-11-03', [['c', 'collect'], ['b', 'return']])];
    const m = closedBySheet(settles);
    expect(Object.fromEntries(m)).toEqual({ a: { day: '2026-11-02', kind: 'collected' }, b: { day: '2026-11-01', kind: 'returned' }, c: { day: '2026-11-03', kind: 'collected' } });   // c came back in part, then got paid
    const g = collectByDay({ orders: [], settles }, '2026-11-01', '2026-11-03');
    for (const r of g) {
      const on = [...m.values()].filter((x) => x.day === r.day);
      expect([r.collected, r.returned]).toEqual([on.filter((x) => x.kind === 'collected').length, on.filter((x) => x.kind === 'returned').length]);
    }
  });
});

describe('collections graph', () => {
  const st = (id: string, date: string, due: number, collect: number) => ({ id, date, totals: { sales: 0, cod: 0, shipping: 0, due, vendoor: 0 }, rows: Array.from({ length: collect }, (_, i) => ({ ref: `${id}-${i}`, type: 'collect', date, cod: 0, supply: 0 })) }) as unknown as Settlement;
  const settles = [st('A', '2026-11-01', 100, 2), st('B', '2026-11-03', 300, 3), st('C', '2026-11-08', 200, 1)];
  it('this period against the one before it, with the average of the days that had money', () => {
    const r = collectTrend({ orders: [], settles }, '2026-11-09', 7, 'due');   // 3 Nov .. 9 Nov against 27 Oct .. 2 Nov
    expect([r.cur, r.prev, r.avg]).toEqual([500, 100, 250]);   // 300 + 200 over the 2 days that had money
    expect(r.rows).toHaveLength(7); expect(r.rows[0]).toMatchObject({ day: '2026-11-03', due: 300, avg: 250 });
    const o = collectTrend({ orders: [], settles }, '2026-11-09', 7, 'collected');
    expect([o.cur, o.prev, o.avg]).toEqual([4, 2, 2]);
  });
  it('any dates: the chosen days against the same number of days right before them', () => {
    const r = collectTrendRange({ orders: [], settles }, '2026-11-03', '2026-11-08', 'due');   // 6 days, against 28 Oct .. 2 Nov
    expect([r.cur, r.prev, r.rows.length]).toEqual([500, 100, 6]);
    expect(collectTrendRange({ orders: [], settles }, '2026-11-03', '2026-11-09', 'due')).toEqual(collectTrend({ orders: [], settles }, '2026-11-09', 7, 'due'));
  });
  it('nothing in the earlier period gives a zero to compare with, never a crash', () => {
    const r = collectTrend({ orders: [], settles: [] }, '2026-11-09', 14, 'due');
    expect([r.cur, r.prev, r.avg, r.rows.length]).toEqual([0, 0, 0, 14]);
  });
});
