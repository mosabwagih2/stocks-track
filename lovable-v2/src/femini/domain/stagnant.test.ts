import { describe, expect, it } from 'vitest';
import { stagnantSkus } from './stagnant';
import type { Order } from './types';

const o = (pickupId: string, lines: string[], status: Order['status'] = 'open') => ({ pickupId, lines, status }) as unknown as Order;
const bal = { a: { READY: 10 }, b: { READY: 5 }, c: { READY: 7 }, d: { READY: 0 }, e: { READY: 3 } } as never;
const pd = new Map([['P1', '2026-10-20'], ['P2', '2026-11-05'], ['P3', '2026-10-27']]);

describe('stagnant items', () => {
  it('ready stock not requested for 14+ days, or never, with the last request and how long ago', () => {
    // today 10 Nov: a asked on 20 Oct (21 days ago), b on 5 Nov (5 days), c on 27 Oct (14 days: counts), d has no stock, e never asked
    const orders = [o('P1', ['a']), o('P2', ['b']), o('P3', ['c']), o('P2', ['d'])];
    const r = stagnantSkus([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }, { id: 'e' }], bal, orders, pd, '2026-11-10');
    expect(r.map((x) => [x.sku, x.ready, x.last, x.idle])).toEqual([['a', 10, '2026-10-20', 21], ['c', 7, '2026-10-27', 14], ['e', 3, '', null]]);
  });
  it('a cancelled order is not a request, a recent one takes the item out, a later request wins', () => {
    const orders = [o('P2', ['a'], 'cancelled'), o('P1', ['a']), o('P2', ['e'])];
    const r = stagnantSkus([{ id: 'a' }, { id: 'e' }], bal, orders, pd, '2026-11-10');
    expect(r.map((x) => x.sku)).toEqual(['a']);   // e was asked 5 days ago; a only by a cancelled recent order and an old one
    expect(r[0].last).toBe('2026-10-20');
  });
});
