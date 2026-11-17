import { describe, expect, it } from 'vitest';
import { collectedOf, returnedAfterCollect, type Settlement } from './settle';
import { closedBySheet, collectByDay } from './trends';
import { warehouseDays } from './warehouseDay';
import type { Order } from './types';

const o = (ref: string, at: string, extra: Partial<Order> = {}) => ({ ref, waybill: '9' + ref, status: 'shipped', shippedAt: at, total: 500, lines: ['a', 'b'], unmapped: [], ...extra }) as unknown as Order;
const st = (id: string, date: string, rows: [string, string, number, string?][]) => ({ id, date, totals: { due: rows.reduce((a, r) => a + r[2], 0) }, rows: rows.map(([ref, type, supply, d]) => ({ ref, type, supply, date: d ?? date })) }) as unknown as Settlement;

// a1 was collected on 3 Nov (300) and came back by a return document on 6 Nov; a2 stays collected (200); a3 returned, never collected
const orders = [o('a1', '2026-11-01T08:00:00Z', { returned: { doc: 'RTN-1', at: '2026-11-06T10:00:00Z' } }), o('a2', '2026-11-01T09:00:00Z'), o('a3', '2026-11-01T10:00:00Z', { returned: { doc: 'RTN-2', at: '2026-11-04T10:00:00Z' } })];
const settles = [st('S1', '2026-11-03', [['a1', 'collect', 300], ['a2', 'collect', 200]])];

describe('collected, then returned: the money comes off the collection', () => {
  it('finds only the orders that were paid and then came back, on the day they came back', () => {
    expect(returnedAfterCollect(settles, orders)).toEqual([{ ref: 'a1', doc: 'RTN-1', day: '2026-11-06', due: 300, paidOn: '2026-11-03' }]);
  });
  it('a return document dated before the payment deducts on the payment day, never before', () => {
    const early = [o('a1', '2026-11-01T08:00:00Z', { returned: { doc: 'RTN-1', at: '2026-11-02T10:00:00Z' } })];
    expect(returnedAfterCollect(settles, early)[0]).toMatchObject({ day: '2026-11-03' });
  });
  it('such an order is no longer collected: it counts as returned', () => {
    const { collected, returned } = collectedOf(settles, new Set(['a1']));
    expect([...collected.keys()]).toEqual(['a2']); expect(returned.has('a1')).toBe(true);
    expect([...collectedOf(settles).collected.keys()]).toEqual(['a1', 'a2']);   // without the set: as before
  });
  it('the collections graph: orders net, money deducted on the return day', () => {
    const back = returnedAfterCollect(settles, orders);
    const m = closedBySheet(settles, back);
    expect(m.get('a1')).toEqual({ day: '2026-11-06', kind: 'returned' }); expect(m.get('a2')).toEqual({ day: '2026-11-03', kind: 'collected' });
    const g = collectByDay({ orders, settles }, '2026-11-01', '2026-11-08');
    expect(g.find((x) => x.day === '2026-11-03')).toMatchObject({ collected: 1, due: 500 });   // the sheet's day keeps the sheet's money
    expect(g.find((x) => x.day === '2026-11-06')).toMatchObject({ returned: 1, due: -300 });
    expect(g.at(-1)!.paidSoFar).toBe(200);                                                        // 500 came, 300 went back
    // a window that starts after the return: the deduction is already inside the starting balance
    expect(collectByDay({ orders, settles }, '2026-11-07', '2026-11-08')[0].paidSoFar).toBe(200);
  });
  it('the warehouse day: the order is returned, its التوريد deducted, not counted as collected', () => {
    const [d] = warehouseDays({ orders, settles }, '2026-11-01', '2026-11-09');
    expect(d).toMatchObject({ collected: 1, returned: 2, due: 200 });
    expect(d.list.find((w) => w.ref === 'a1')).toMatchObject({ state: 'returned', due: 0, deducted: 300, closedOn: '2026-11-06' });
  });
});
