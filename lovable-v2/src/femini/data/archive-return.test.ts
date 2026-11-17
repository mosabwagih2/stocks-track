// A returned order whose pickup was archived: the archive is a reference (its pieces), nothing else in the system changes.
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('./photos', () => ({
  putPhoto: async () => {}, getPhoto: async () => null, clearPhotos: async () => {},
  shrinkImage: async (f: Blob) => f, exportMedia: async () => ({}), replaceMedia: async () => {},
}));

import { createMemoryRepo } from './memory';
import { balancesFromMoves, locTotal } from '@/femini/domain/ledger';
import { cairoToday } from '@/femini/domain/dates';
import { allocate } from '@/femini/domain/orders';
import type { Order } from '@/femini/domain/types';

type R = ReturnType<typeof createMemoryRepo>;
beforeEach(() => localStorage.clear());
const READY = async (r: R) => locTotal(balancesFromMoves((await r.snapshot()).moves), 'READY');
const openOrder = async (r: R) => { const s = await r.snapshot(); const open = s.orders.filter((o) => o.status === 'open'); const { blocked } = allocate(open, s.pickups, s.balances); return open.find((o) => o.lines.length > 1 && !blocked.has(o.ref))!; };
const returnAll = (o: Order) => { const e: Record<string, number> = {}; o.lines.forEach((s) => (e[s] = (e[s] ?? 0) + 1)); return Object.keys(e).map((sku) => ({ sku, q: 0, exp: e[sku], r: e[sku], d: 0, x: 0 })); };
const rtn = (r: R, refs: string[], lines: ReturnType<typeof returnAll>) => r.postOp({ type: 'RTN', date: cairoToday(), hdr: { refs, counted: true }, lines });

it('an archived order can be returned: its pieces come back, and nothing else about it changes', async () => {
  const r = createMemoryRepo(); const o = await openOrder(r); const base = await READY(r);
  const before = await r.snapshot();
  await r.pickupDelete(o.pickupId);                       // archive its pickup (its orders leave the live orders)
  const arch = await r.snapshot();
  expect(arch.orders.some((x) => x.ref === o.ref)).toBe(false);
  const orders0 = arch.orders.length; const archived0 = JSON.stringify(arch.archivedPickups);
  await rtn(r, [o.ref], returnAll(o));
  const after = await r.snapshot();
  expect(await READY(r)).toBe(base + o.lines.length);     // the pieces are back in stock
  expect(after.orders.length).toBe(orders0);              // not an order again
  expect(JSON.stringify(after.archivedPickups)).toBe(archived0);   // the archive is untouched: a reference only
  expect(after.settles ?? []).toEqual(before.settles ?? []);       // no money anywhere
  expect(after.docs.at(-1)).toMatchObject({ type: 'RTN', status: 'done' });
});

it('it can be returned only once, and an unknown order is still refused', async () => {
  const r = createMemoryRepo(); const o = await openOrder(r);
  await r.pickupDelete(o.pickupId);
  await rtn(r, [o.ref], returnAll(o));
  await expect(rtn(r, [o.ref], returnAll(o))).rejects.toThrow(/اتسجل له مرتجع/);
  await expect(rtn(r, ['zz9999'], returnAll(o))).rejects.toThrow(/مش موجود/);
});

it('a live order that was never shipped is still refused (only the archive is a reference)', async () => {
  const r = createMemoryRepo(); const o = await openOrder(r);
  await expect(rtn(r, [o.ref], returnAll(o))).rejects.toThrow(/مش متشحن/);
});
