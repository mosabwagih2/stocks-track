// Regression tests for the defects found in the first code review. Each one failed before the fix.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./photos', () => ({
  putPhoto: async () => {}, getPhoto: async () => null, clearPhotos: async () => {},
  shrinkImage: async (f: Blob) => f, exportMedia: async () => ({}), replaceMedia: async () => {},
}));

import { createMemoryRepo } from './memory';
import { balancesFromMoves, locTotal, qty } from '@/femini/domain/ledger';
import { cairoToday } from '@/femini/domain/dates';
import { dayReport } from '@/femini/domain/reports';
import { findByCode } from '@/femini/domain/orders';
import { matchScans } from '@/femini/domain/scan';
import { validateBackup } from './backup';
import type { Order, Snapshot } from '@/femini/domain/types';

beforeEach(() => localStorage.clear());
const photo = () => new File(['x'], 'p.jpg', { type: 'image/jpeg' });
type R = ReturnType<typeof createMemoryRepo>;
const ready = async (r: R) => locTotal(balancesFromMoves((await r.snapshot()).moves), 'READY');
const firstOpen = async (r: R) => (await r.snapshot()).orders.find((o) => o.status === 'open' && o.lines.length > 0)!;
const returnAll = (o: Order) => { const exp: Record<string, number> = {}; o.lines.forEach((s) => (exp[s] = (exp[s] ?? 0) + 1)); return Object.keys(exp).map((sku) => ({ sku, q: 0, exp: exp[sku], r: exp[sku], d: 0, x: 0 })); };

describe('shipments, returns and cancellations never return the same pieces twice', () => {
  it('reversing a sheet after one of its orders was cancelled with its stock returned', async () => {
    const r = createMemoryRepo(); const o = await firstOpen(r); const base = await ready(r);
    const { doc } = await r.shipOrders({ refs: [o.ref], employee: 't', source: 't' });
    await r.cancelOrder({ code: o.ref, reason: 'x', returnStock: true, photo: photo() });
    expect(await ready(r)).toBe(base);
    await r.reverseShipment(doc);
    expect(await ready(r)).toBe(base);                                   // not base + the order's pieces
  });
  it('reversing a sheet keeps a cancelled order cancelled', async () => {
    const r = createMemoryRepo(); const o = await firstOpen(r);
    const { doc } = await r.shipOrders({ refs: [o.ref], employee: 't', source: 't' });
    await r.cancelOrder({ code: o.ref, reason: 'x', returnStock: false, photo: photo() });
    await r.reverseShipment(doc);
    expect((await r.snapshot()).orders.find((x) => x.ref === o.ref)!.status).toBe('cancelled');
  });
  it('reversing a sheet twice is refused even when nothing had to be put back', async () => {
    const r = createMemoryRepo(); const o = await firstOpen(r);
    const { doc } = await r.shipOrders({ refs: [o.ref], employee: 't', source: 't' });
    await r.cancelOrder({ code: o.ref, reason: 'x', returnStock: true, photo: photo() });
    await r.reverseShipment(doc);
    await expect(r.reverseShipment(doc)).rejects.toThrow();
  });
  it('reversing a plain sheet still puts everything back and reopens the orders', async () => {
    const r = createMemoryRepo(); const o = await firstOpen(r); const base = await ready(r);
    const { doc } = await r.shipOrders({ refs: [o.ref], employee: 't', source: 't' });
    expect(await ready(r)).toBe(base - o.lines.length);
    await r.reverseShipment(doc);
    expect(await ready(r)).toBe(base);
    expect((await r.snapshot()).orders.find((x) => x.ref === o.ref)!.status).toBe('open');
  });
  it('cancelling with "return the stock" after a customer return does not return it again', async () => {
    const r = createMemoryRepo(); const o = await firstOpen(r); const base = await ready(r);
    await r.shipOrders({ refs: [o.ref], employee: 't', source: 't' });
    await r.postOp({ type: 'RTN', date: cairoToday(), hdr: { refs: [o.ref], counted: true }, lines: returnAll(o) });
    expect(await ready(r)).toBe(base);
    await r.cancelOrder({ code: o.ref, reason: 'x', returnStock: true, photo: photo() });
    expect(await ready(r)).toBe(base);                                   // not base + the order's pieces
    await r.restoreOrder(o.ref);
    expect((await r.snapshot()).orders.find((x) => x.ref === o.ref)!.status).toBe('shipped');
  });
});

describe('pickups', () => {
  it('a new pickup never takes the number of an archived one, and the archive restores cleanly', async () => {
    const r = createMemoryRepo(); const T = cairoToday();
    const mk = (ref: string) => ({ ref, waybill: ref, type: 'new' as const, gov: 'x', total: 1, lines: [], unmapped: [] });
    const a = await r.importPickup({ label: 'a', date: T, channel: 'VENDOOR', source: 's', orders: [mk('zz1')] });
    await r.pickupDelete(a.pickup);
    const b = await r.importPickup({ label: 'b', date: T, channel: 'VENDOOR', source: 's', orders: [mk('zz2')] });
    expect(b.pickup).not.toBe(a.pickup);
    await r.restoreArchive('pickup', a.pickup);
    const ids = (await r.snapshot()).pickups.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(a.pickup); expect(ids).toContain(b.pickup);
  });
});

describe('data safety', () => {
  it('a backup taken after a hold can be restored', async () => {
    const r = createMemoryRepo(); const s = await r.snapshot();
    const sku = Object.entries(balancesFromMoves(s.moves)).find(([, v]) => (v.READY ?? 0) >= 2)![0];
    await r.holdOut({ who: 'x', note: '', reason: 'shoot', reasonText: '', lines: [{ sku, q: 1 }], photo: photo() });
    const b = await r.exportBackup();
    expect(() => validateBackup(b)).not.toThrow();
    await expect(r.restoreBackup(b)).resolves.toBeUndefined();
  });
  it('unreadable saved data is kept aside instead of being silently overwritten', async () => {
    localStorage.setItem('femini-web-demo-2', '{"v":2,"moves":[BROKEN');
    const r = createMemoryRepo(); await r.setAutoClose(false);
    expect(localStorage.getItem('femini-web-demo-2-unreadable')).toBe('{"v":2,"moves":[BROKEN');
  });
  it('data written by a different version is kept aside too', async () => {
    const other = JSON.stringify({ v: 3, anything: true });
    localStorage.setItem('femini-web-demo-2', other);
    const r = createMemoryRepo(); await r.setAutoClose(false);
    expect(localStorage.getItem('femini-web-demo-2-unreadable')).toBe(other);
  });
});

describe('Cairo days and waybills', () => {
  it('a cancellation at 00:30 Cairo time belongs to that Cairo day, not to the UTC day before', () => {
    // 2026-11-06T22:30Z is 00:30 on 7 November in Cairo (UTC+2)
    const o = { ref: 'r', pickupId: 'P1', lines: ['A'], cancel: { at: '2026-11-06T22:30:00Z' }, shippedAt: null } as unknown as Order;
    const rep = dayReport({ moves: [], orders: [o], pickups: [{ id: 'P1', date: '2026-11-01' }] } as unknown as Snapshot, '2026-11-06');
    expect(rep.open).toBe(1);
  });
  it('an upper-case waybill is found by scanning and by the cancel lookup', () => {
    const o = { ref: 'abc', waybill: 'EG123X', status: 'open', unmapped: [], lines: [] } as unknown as Order;
    expect(matchScans([{ code: 'EG123X', time: '', name: '' }], [o]).matched).toEqual(['abc']);
    expect(findByCode([o], 'eg123x')?.ref).toBe('abc');
    expect(findByCode([o], 'EG123X')?.ref).toBe('abc');
  });
});

describe('size swap', () => {
  it('moves pieces to another size and leaves the total unchanged', async () => {
    const r = createMemoryRepo(); const T = cairoToday(); const s0 = await r.snapshot(); const b0 = balancesFromMoves(s0.moves);
    const [A, B] = s0.skus.flatMap((a) => s0.skus.filter((b) => b.id !== a.id && b.model === a.model && b.color === a.color).map((b) => [a.id, b.id]))
      .find(([a, b]) => qty(b0, a, 'READY') >= 5 && qty(b0, b, 'READY') >= 1)!;
    const total = locTotal(b0, 'READY');
    const res = await r.postOp({ type: 'SWP', date: T, hdr: {}, lines: [{ sku: A, to: B, q: 3 }] });
    const s1 = await r.snapshot(); const b1 = balancesFromMoves(s1.moves);
    expect(qty(b1, A, 'READY')).toBe(qty(b0, A, 'READY') - 3);
    expect(qty(b1, B, 'READY')).toBe(qty(b0, B, 'READY') + 3);
    expect(locTotal(b1, 'READY')).toBe(total);
    expect(s1.moves.filter((m) => m.doc === res.doc && m.type === 'SWP')).toHaveLength(2);
    const n = s1.moves.length;
    await expect(r.postOp({ type: 'SWP', date: T, hdr: {}, lines: [{ sku: A, to: B, q: 999999 }] })).rejects.toThrow();
    await expect(r.postOp({ type: 'SWP', date: T, hdr: {}, lines: [{ sku: A, to: A, q: 1 }] })).rejects.toThrow();
    expect((await r.snapshot()).moves.length).toBe(n);
  });
});
