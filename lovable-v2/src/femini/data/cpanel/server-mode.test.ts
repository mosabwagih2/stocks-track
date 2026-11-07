// The server edition on a small server state (no live data needed): every action is pushed through the copy of the PHP
// rules (fake-server.ts), must be accepted, and a fresh load from the server must show exactly what the app shows.
import { afterEach, describe, expect, it } from 'vitest';
import seed from '../seed.json';
import { createMemoryRepo } from '../memory';
import { setActor } from '../repo';
import { createServerBackend } from './backend';
import { createFakeServer, type FakeUser } from './fake-server';
import { isEmpty, mirrorFromBoot, toLovable, toPush, type Boot } from './v3';
import { addDays, cairoToday } from '@/femini/domain/dates';
import { violations } from '@/femini/test-utils/invariants';

const T = cairoToday();
const ADMIN: FakeUser = { id: 'u1', name: 'Mosab', role: 'admin', perms: [] };
const skus = seed.skus.slice(0, 12).map((k) => k.id);
const boot = (): Boot => ({
  rev: 1, csrf: 'x', user: ADMIN, files: [],
  state: { v: 3, moves: skus.map((sku, i) => ({ id: i + 1, t: Date.parse(`${addDays(T, -10)}T08:00:00Z`), date: addDays(T, -10), sku, q: 20, from: 'EXT_OPEN', to: 'READY', type: 'OPN', doc: 'OPN-0001', by: 'النظام', note: '' })), mid: skus.length + 1, docs: [], did: 1, seq: { OPN: 1 }, pickups: [], orders: [], emps: [], sup: { items: [], log: [], eid: 1 }, st: {}, costs: {}, alias: {}, img: {}, lock: addDays(T, -2), shops: [], closes: [], archPk: [], archDocs: [], oldOrd: [] },
});
const photo = () => new File(['x'], 'p.jpg', { type: 'image/jpeg' });
afterEach(() => setActor(null));

async function check(srv: ReturnType<typeof createFakeServer>, r: ReturnType<typeof createMemoryRepo>) {
  const s = await r.snapshot(); const fresh = toLovable(mirrorFromBoot(srv.bootNow()));
  expect(fresh.moves.length).toBe(s.moves.length);
  expect(fresh.orders.map((o) => [o.ref, o.status, o.shipDoc ?? null])).toEqual(s.orders.map((o) => [o.ref, o.status, o.shipDoc ?? null]));
  expect(fresh.docs.map((d) => [d.no, d.status])).toEqual(s.docs.map((d) => [d.no, d.status]));
  expect(violations(s)).toEqual([]);
  const m = mirrorFromBoot(srv.bootNow()); expect(isEmpty(toPush(toLovable(m), m, ADMIN.name))).toBe(true);
}

describe('server edition', () => {
  it('a working day goes through the server rules and reloads identically', async () => {
    const srv = createFakeServer(boot(), ADMIN); setActor(ADMIN.name);
    const r = createMemoryRepo(createServerBackend(srv.bootNow(), srv.transport));
    await r.snapshot(); await check(srv, r);   // the automatic close of yesterday
    const ord = (ref: string, lines: string[]) => ({ ref, waybill: `9${ref}`, type: 'new' as const, gov: '', total: 0, lines, unmapped: [] });
    await r.importPickup({ label: 'ب', date: T, channel: 'VENDOOR', source: 'x', orders: [ord('A1', [skus[0], skus[1]]), ord('A2', [skus[2]]), ord('A3', [skus[3]])] }); await check(srv, r);
    const a = await r.shipOrders({ refs: ['A1', 'A2'], employee: ADMIN.name, source: 'scan' }); await check(srv, r);
    await r.cancelOrder({ code: 'A2', reason: 'x', returnStock: true, photo: photo() }); await check(srv, r);
    await r.restoreOrder('A2'); await check(srv, r);
    await r.reverseShipment(a.doc); await check(srv, r);
    await r.shipOrders({ refs: ['A1', 'A3'], employee: ADMIN.name, source: 'scan' }); await check(srv, r);
    await r.postOp({ type: 'RTN', date: T, hdr: { refs: ['A1'], counted: true }, lines: [{ sku: skus[0], q: 0, exp: 1, r: 1, d: 0, x: 0 }, { sku: skus[1], q: 0, exp: 1, r: 0, d: 1, x: 0 }] }); await check(srv, r);
    const h = await r.holdOut({ who: 'م', note: '', reason: 'shoot', reasonText: '', lines: [{ sku: skus[5], q: 2 }], photo: photo() }); await check(srv, r);
    await r.holdSettle({ no: h, ret: [{ sku: skus[5], q: 1, to: 'READY' }], off: [{ sku: skus[5], q: 1 }], note: '', photo: photo() }); await check(srv, r);
    await r.moveState({ lines: [{ sku: skus[6], qty: 1 }], from: 'READY', to: 'DIRTY', reason: 'x' }); await check(srv, r);
    await r.postOp({ type: 'SHP', date: T, hdr: { shop: 'المحل' }, lines: [{ sku: skus[7], q: 2 }] }); await check(srv, r);
    await r.closeDay(T); await check(srv, r);
    await expect(r.postOp({ type: 'CLN', date: T, hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku: skus[8], q: 1 }] })).rejects.toThrow(/مقفول/);
    await r.reopenDay(T); await check(srv, r);
  });

  it('a role without the permission is refused and nothing is kept', async () => {
    const pack: FakeUser = { id: 'u2', name: 'Abdallah', role: 'pack', perms: ['scan', 'returns'] };
    const srv = createFakeServer(boot(), pack); setActor(pack.name);
    const r = createMemoryRepo(createServerBackend({ ...srv.bootNow(), user: pack }, srv.transport));
    const before = (await r.snapshot()).moves.length;
    await expect(r.postOp({ type: 'SHP', date: T, hdr: { shop: 'م' }, lines: [{ sku: skus[0], q: 1 }] })).rejects.toThrow(/دورك/);
    expect((await r.snapshot()).moves.length).toBe(before);
  });
});
