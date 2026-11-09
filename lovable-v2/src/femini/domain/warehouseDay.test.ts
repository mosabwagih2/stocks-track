import { describe, expect, it } from 'vitest';
import { warehouseDays } from './warehouseDay';
import type { Order } from './types';
import type { Settlement } from './settle';

const o = (ref: string, at: string, extra: Partial<Order> = {}) => ({ ref, waybill: '9' + ref, status: 'shipped', shippedAt: at, total: 500, lines: ['a', 'b'], unmapped: [], ...extra }) as unknown as Order;
const st = (id: string, date: string, rows: [string, string, number, number, string?][]) => ({ id, date, totals: {}, rows: rows.map(([ref, type, total, supply, d]) => ({ ref, type, total, fees: 50, cod: total - 50, supply, date: d ?? date })) }) as unknown as Settlement;

describe('warehouse day close', () => {
  it('counts every order on the day it left, whatever day its money came on', () => {
    const orders = [o('a1', '2026-11-05T08:00:00Z'), o('a2', '2026-11-05T09:00:00Z'), o('a3', '2026-11-05T10:00:00Z'), o('a4', '2026-11-05T11:00:00Z'), o('b1', '2026-11-06T09:00:00Z'), o('c1', '2026-11-05T12:00:00Z', { status: 'cancelled' })];
    const settles = [st('S1', '2026-11-06', [['a1', 'collect', 500, 300]]), st('S2', '2026-11-08', [['a2', 'collect', 400, 250], ['a3', 'return', 0, 0], ['a1', 'adjust', 0, -20]])];
    const [d6, d5] = warehouseDays({ orders, settles }, '2026-11-01', '2026-11-09');
    expect(d6.day).toBe('2026-11-06'); expect(d6.pending).toBe(1);
    expect(d5).toMatchObject({ day: '2026-11-05', orders: 4, pieces: 8, collected: 2, returned: 1, pending: 1, pendingValue: 500, sales: 900, due: 530 });
    expect(d5.paidOn).toEqual([{ date: '2026-11-06', n: 1 }, { date: '2026-11-08', n: 1 }]);
    expect(d5.list[0]).toMatchObject({ ref: 'a4', state: 'pending' });   // what is still out comes first
  });
});
