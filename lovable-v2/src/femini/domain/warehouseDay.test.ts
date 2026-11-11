import { describe, expect, it } from 'vitest';
import { lateDays, lateLevel, warehouseDays } from './warehouseDay';
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
    expect(d5).toMatchObject({ day: '2026-11-05', orders: 4, pieces: 8, collected: 2, returned: 1, pending: 1, pendingPieces: 2, due: 530 });
    expect(d5).not.toHaveProperty('sales'); expect(d5.list[0]).not.toHaveProperty('expected');   // only التوريد, never the order value
    expect(d5.paidOn).toEqual([{ date: '2026-11-06', n: 1 }, { date: '2026-11-08', n: 1 }]);
    expect(d5.list[0]).toMatchObject({ ref: 'a4', state: 'pending' });   // what is still out comes first
  });
  it('a day closes when nothing on it is pending, on the last day anything was collected or came back', () => {
    const orders = [o('a1', '2026-11-01T08:00:00Z'), o('a2', '2026-11-01T09:00:00Z'), o('a3', '2026-11-01T10:00:00Z', { returned: { doc: 'RTN-1', at: '2026-11-07T10:00:00Z' } }), o('b1', '2026-11-02T08:00:00Z'), o('b2', '2026-11-02T09:00:00Z')];
    const settles = [st('S1', '2026-11-03', [['a1', 'collect', 500, 300], ['b1', 'collect', 500, 300]]), st('S2', '2026-11-05', [['a2', 'return', 0, 0, '2026-11-04']])];
    const [d2, d1] = warehouseDays({ orders, settles }, '2026-11-01', '2026-11-09');
    // 1 Nov: collected a1 (3 Nov), a2 came back (4 Nov), a3 came back by a customer-return document (7 Nov): closed on the 7th
    expect(d1).toMatchObject({ day: '2026-11-01', pending: 0, collected: 1, returned: 2, closedOn: '2026-11-07', collectedPieces: 2, returnedPieces: 4, pendingPieces: 0 });
    // 2 Nov: b2 is still out
    expect(d2).toMatchObject({ day: '2026-11-02', pending: 1, closedOn: '', pendingPieces: 2, collected: 1 });
  });
  it('how late the open days are: 7+ days late, 10+ very late, closed days never count', () => {
    expect([0, 6, 7, 9, 10, 30].map(lateLevel)).toEqual([0, 0, 1, 1, 2, 2]);
    const orders = [o('x1', '2026-11-01T08:00:00Z'), o('y1', '2026-11-05T08:00:00Z'), o('z1', '2026-10-20T08:00:00Z')];
    const settles = [st('S', '2026-10-25', [['z1', 'collect', 500, 300]])];   // 20 Oct is closed
    expect(lateDays({ orders, settles }, '2026-11-09')).toEqual({ level: 1, late: 1, veryLate: 0, oldest: 8 });   // 1 Nov is 8 days old, 5 Nov is 4
    expect(lateDays({ orders, settles }, '2026-11-12')).toMatchObject({ level: 2, late: 2, veryLate: 1 });
    expect(lateDays({ orders: [], settles: [] }, '2026-11-09')).toEqual({ level: 0, late: 0, veryLate: 0, oldest: 0 });
  });
});
