// The server edition, end to end, on a copy of the LIVE data: every action of the app is pushed through a line-by-line
// copy of the PHP server's rules (fake-server.ts). After every action the server must have accepted it, the stock rules
// must hold, and a fresh page load from the server must show exactly what the app shows.
// Needs FEMINI_LIVE_BOOT (a boot.json saved from the running site); skipped otherwise.
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createMemoryRepo } from '../memory';
import { setActor } from '../repo';
import { createServerBackend } from './backend';
import { createFakeServer, type FakeUser } from './fake-server';
import { isEmpty, mirrorFromBoot, toLovable, toPush, type Boot } from './v3';
import { allocate } from '@/femini/domain/orders';
import { addDays, cairoToday } from '@/femini/domain/dates';
import { qty } from '@/femini/domain/ledger';
import { violations } from '@/femini/test-utils/invariants';
import type { Order } from '@/femini/domain/types';

const path = process.env.FEMINI_LIVE_BOOT;
const boot = path && fs.existsSync(path) ? (JSON.parse(fs.readFileSync(path, 'utf8')) as Boot) : null;
const ADMIN: FakeUser = { id: 'u1', name: 'Mosab', role: 'admin', perms: [] };
const PACK: FakeUser = { id: 'u2', name: 'Abdallah', role: 'pack', perms: ['scan', 'returns'] };
const photo = (n = 'p.jpg') => new File(['x'], n, { type: 'image/jpeg' });
const T = cairoToday();

function setup(user = ADMIN, srv = createFakeServer(boot!, ADMIN)) {
  const backend = createServerBackend(srv.bootNow(), srv.transport);
  setActor(user.name);
  const r = createMemoryRepo(backend);
  return { srv, backend, r };
}
afterEach(() => { setActor(null); base = null; });

type Snap = Awaited<ReturnType<ReturnType<typeof createMemoryRepo>['snapshot']>>;
/** The live data already breaks two rules, for known reasons: a few SKUs went below zero (shipped with a warning), and
 * returns of old orders (before the system, `oldOrd`) came back from the channel without having left through it.
 * The actions must leave those exactly as they were, and break nothing else. */
const gap = (s: Snap) => { const g: Record<string, number> = {}; for (const o of s.orders) if (o.status === 'shipped' && !o.returned) for (const l of o.lines) g[l] = (g[l] ?? 0) + 1;
  for (const o of s.orders) if (o.status === 'cancelled' && o.cancel?.was === 'shipped' && !o.cancel.returned && !o.returned && o.shipDoc && s.docs.some((d) => d.no === o.shipDoc && d.status === 'done')) for (const l of o.lines) g[l] = (g[l] ?? 0) + 1;
  for (const m of s.moves) { if (m.to === 'EXT_CH') g[m.sku] = (g[m.sku] ?? 0) - m.qty; if (m.from === 'EXT_CH') g[m.sku] = (g[m.sku] ?? 0) + m.qty; }
  return Object.fromEntries(Object.entries(g).filter(([, n]) => n !== 0)); };
const negatives = (s: Snap) => Object.fromEntries(Object.keys(s.balances).map((k) => [k, qty(s.balances, k, 'READY')]).filter(([, n]) => (n as number) < 0));
let base: { gap: Record<string, number>; neg: Record<string, number> } | null = null;
const baseline = (s: Snap) => { base = { gap: gap(s), neg: negatives(s) }; };

/** a fresh page load from the server must show exactly what the app shows */
async function consistent(srv: ReturnType<typeof createFakeServer>, r: ReturnType<typeof createMemoryRepo>) {
  const s = await r.snapshot(); const fresh = toLovable(mirrorFromBoot(srv.bootNow()));
  if (!base) baseline(s);
  expect(fresh.moves.length).toBe(s.moves.length);
  expect(fresh.orders.map((o) => [o.ref, o.status, o.shipDoc ?? null, !!o.cancel, o.returned?.doc ?? null, o.lines.length])).toEqual(s.orders.map((o) => [o.ref, o.status, o.shipDoc ?? null, !!o.cancel, o.returned?.doc ?? null, o.lines.length]));
  expect(fresh.docs.map((d) => [d.no, d.status, !!d.hdr.delivered])).toEqual(s.docs.map((d) => [d.no, d.status, !!d.hdr.delivered]));
  expect((fresh.holds ?? []).map((h) => [h.no, h.status, h.events.length])).toEqual(s.holds.map((h) => [h.no, h.status, h.events.length]));
  expect(fresh.lock ?? '').toBe(s.lock ?? '');
  expect(violations(s).filter((v) => v !== 'negative READY' && v !== 'channel pieces do not match orders' && v !== 'supplies used do not match shipped orders')).toEqual([]);   // supplies: checked exactly where one is used
  expect(gap(s)).toEqual(base!.gap);
  for (const [k, n] of Object.entries(negatives(s))) expect(n, `READY of ${k}`).toBeGreaterThanOrEqual(base!.neg[k] ?? 0);
  const m = mirrorFromBoot(srv.bootNow()); expect(isEmpty(toPush(toLovable(m), m, ADMIN.name))).toBe(true);
}
const readySkus = (s: Awaited<ReturnType<ReturnType<typeof createMemoryRepo>['snapshot']>>, min = 3) => s.skus.filter((k) => qty(s.balances, k.id, 'READY') >= min).map((k) => k.id);

describe.skipIf(!boot)('server edition on the live data', () => {
  it('every action is accepted by the server rules and reloads identically', async () => {
    const { srv, r } = setup();
    let s = await r.snapshot(); const ready = readySkus(s, 6);
    const ord = (ref: string, lines: string[]) => ({ ref, waybill: `9${ref}`, type: 'new' as const, gov: 'القاهرة', total: 500, lines, unmapped: [] });
    // pickup, scan, reversal
    const { pickup } = await r.importPickup({ label: 'اختبار', date: T, channel: 'VENDOOR', source: 'test.xlsx', orders: [ord('ZA1', [ready[0], ready[1]]), ord('ZA2', [ready[2]]), ord('ZA3', [ready[3], ready[3]]), ord('ZA4', [ready[4]])], file: photo('p.xlsx') });
    await consistent(srv, r);
    const a = await r.shipOrders({ refs: ['ZA1', 'ZA2'], employee: ADMIN.name, source: 'scan.csv', file: photo('scan.csv') });
    await consistent(srv, r);
    await r.reverseShipment(a.doc); await consistent(srv, r);
    const b = await r.shipOrders({ refs: ['ZA1', 'ZA2', 'ZA3'], employee: ADMIN.name, source: 'scan2.csv' }); await consistent(srv, r);
    // cancellations and restore
    await r.cancelOrder({ code: 'ZA4', reason: 'لغي', returnStock: false, photo: photo() }); await consistent(srv, r);
    await r.cancelOrder({ code: 'ZA3', reason: 'لغي', returnStock: true, photo: photo() }); await consistent(srv, r);
    await r.restoreOrder('ZA4'); await consistent(srv, r);
    await r.restoreOrder('ZA3'); await consistent(srv, r);
    // customer return
    s = await r.snapshot(); const o1 = s.orders.find((o) => o.ref === 'ZA1')!;
    await r.postOp({ type: 'RTN', date: T, hdr: { refs: ['ZA1'], counted: true }, lines: [{ sku: o1.lines[0], q: 0, exp: 1, r: 1, d: 0, x: 0 }, { sku: o1.lines[1], q: 0, exp: 1, r: 0, d: 0, x: 0 }] }); await consistent(srv, r);
    // warehouse operations
    const k = ready[5];
    await r.postOp({ type: 'CLN', date: T, hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku: k, q: 3 }] }); await consistent(srv, r);
    await r.postOp({ type: 'FSD', date: T, hdr: { kind: 'wash' }, lines: [{ sku: k, q: 2 }] }); await consistent(srv, r);
    await r.postOp({ type: 'FRC', date: T, hdr: {}, lines: [{ sku: k, q: 1, rej: 1 }] }); await consistent(srv, r);
    await r.postOp({ type: 'CLN', date: T, hdr: { from: 'READY', to: 'LOST' }, lines: [{ sku: k, q: 1 }] }); await consistent(srv, r);
    await r.postOp({ type: 'LOS', date: T, hdr: {}, lines: [{ sku: k, q: 1, res: 'FOUND' }] }); await consistent(srv, r);
    const shp = await r.postOp({ type: 'SHP', date: T, hdr: { shop: 'FEMINI BY AURA' }, lines: [{ sku: k, q: 1 }] }); await consistent(srv, r);
    await r.confirmShopDelivery(shp.doc, photo()); await consistent(srv, r);
    s = await r.snapshot(); const now = qty(s.balances, ready[6] ?? k, 'READY');
    await r.postOp({ type: 'CNT', date: T, hdr: { state: 'READY', cnt: { [ready[6] ?? k]: now - 1 }, snap: { [ready[6] ?? k]: now }, reveal: true }, lines: [] }); await consistent(srv, r);
    await r.postOp({ type: 'SWP', date: T, hdr: {}, lines: [{ sku: ready[7], q: 1, to: ready[8] }] }); await consistent(srv, r);
    await r.postOp({ type: 'RCV', date: T, hdr: { ref: 'F-1', declared: 2 }, lines: [{ sku: k, q: 2 }], photo: photo() }); await consistent(srv, r);
    await r.moveState({ lines: [{ sku: ready[9], qty: 1 }], from: 'READY', to: 'DIRTY', reason: 'اختبار' }); await consistent(srv, r);
    // holds
    const h = await r.holdOut({ who: 'مصورة', note: '', reason: 'shoot', reasonText: '', lines: [{ sku: ready[10], q: 3 }], photo: photo() }); await consistent(srv, r);
    await r.holdSettle({ no: h, ret: [{ sku: ready[10], q: 1, to: 'READY' }], off: [], note: '', photo: null }); await consistent(srv, r);
    await r.holdSettle({ no: h, ret: [{ sku: ready[10], q: 1, to: 'DIRTY' }], off: [{ sku: ready[10], q: 1 }], note: '', photo: photo() }); await consistent(srv, r);
    // supplies
    const sid = await r.supplySave({ name: 'فلاير', unit: 'قطعة', pack: 1, packName: '', minAlert: 10, note: '', rule: { kind: 'order', qty: 1 }, open: 100 }); await consistent(srv, r);
    const mv = await r.supplyMove({ item: sid, kind: 'rcv', qty: 50, why: 'توريد' }); await r.undoSupplyMove(mv.id); await consistent(srv, r);
    await r.shipOrders({ refs: ['ZA4'], employee: ADMIN.name, source: 'scan3.csv' }); await consistent(srv, r);   // consumes the flyer
    s = await r.snapshot(); expect(s.supplyLog.filter((e) => e.item === sid).reduce((x, e) => x + e.qty, 0)).toBe(99);   // 100 open, +50 −50 undone, −1 flyer
    // catalog
    await r.catalogNewModel({ code: 'TST9', name: 'تجربة', colors: ['احمر'], sizes: ['M', 'L'], minAlert: 0 }); await consistent(srv, r);
    await r.catalogEditModel({ code: 'TST9', name: 'تجربة 2', add: [{ color: 'اسود', size: 'M' }], remove: ['TST9-RED-L'] }); await consistent(srv, r);
    await r.catalogRestore({ model: 'TST9', sku: 'TST9-RED-L' }); await consistent(srv, r);
    await r.setModelCosts('TST9', 100, 250); await consistent(srv, r);
    // pickups and drafts
    await r.pickupUpdate({ id: pickup, label: 'اختبار 2', date: T, channel: 'VENDOOR' }); await consistent(srv, r);
    const p2 = await r.importPickup({ label: 'هيتشال', date: T, channel: 'VENDOOR', source: 'x', orders: [ord('ZB1', [ready[0]])] });
    await r.pickupDelete(p2.pickup); await consistent(srv, r);
    await r.restoreArchive('pickup', p2.pickup); await consistent(srv, r);
    const dId = await r.saveDraft({ type: 'CLN', date: T, hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku: k, q: 1 }] }); await consistent(srv, r);
    await r.deleteDraft(dId); await consistent(srv, r);
    await r.restoreArchive('draft', dId); await consistent(srv, r);
    await r.renameShipmentEmployee(b.doc, ADMIN.name); await consistent(srv, r);
    // closing and reopening today
    await r.closeDay(T); await consistent(srv, r);
    await expect(r.postOp({ type: 'CLN', date: T, hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku: k, q: 1 }] })).rejects.toThrow(/مقفول/);
    await r.reopenDay(T); await consistent(srv, r);
    await r.postOp({ type: 'CLN', date: T, hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku: k, q: 1 }] }); await consistent(srv, r);
  }, 120_000);

  it('a forgotten pickup and scan of a closed past day: reopen, upload, both land on that day', async () => {
    const { srv, r } = setup(); const y = addDays(T, -1);
    let s = await r.snapshot(); const ready = readySkus(s);
    const ord = { ref: 'ZY1', waybill: '1', type: 'new' as const, gov: '', total: 0, lines: [ready[0]], unmapped: [] };
    if ((s.lock ?? '') >= y) await expect(r.importPickup({ label: 'نسيته', date: y, channel: 'VENDOOR', source: 'x', orders: [ord] })).rejects.toThrow(/مقفول/);
    await r.reopenDay(y); await consistent(srv, r);
    await r.importPickup({ label: 'نسيته', date: y, channel: 'VENDOOR', source: 'x', orders: [ord] });
    const { doc } = await r.shipOrders({ refs: ['ZY1'], employee: ADMIN.name, source: 'scan.csv', date: y }); await consistent(srv, r);
    s = await r.snapshot();
    expect(s.moves.filter((m) => m.doc === doc).every((m) => m.date === y)).toBe(true);
  });

  it('the server refuses what the role does not allow, and the screen goes back to what the server holds', async () => {
    const srv = createFakeServer(boot!, PACK); const { r } = setup(PACK, srv);
    const s = await r.snapshot(); const k = readySkus(s)[0]; const before = s.moves.length;
    await expect(r.postOp({ type: 'SHP', date: T, hdr: { shop: 'محل' }, lines: [{ sku: k, q: 1 }] })).rejects.toThrow(/دورك/);
    const after = await r.snapshot();
    expect(after.moves.length).toBe(before);
    expect(after.docs.some((d) => d.type === 'SHP' && d.date === T && d.lines[0]?.sku === k)).toBe(false);
  });

  it('two people at the same moment: the second one is refused, reloads, and sees the first one\'s work', async () => {
    const srv = createFakeServer(boot!, ADMIN);
    const A = setup(ADMIN, srv); const s0 = await A.r.snapshot(); const k = readySkus(s0)[0];
    await A.r.importPickup({ label: 'x', date: T, channel: 'VENDOOR', source: 'x', orders: [{ ref: 'ZC1', waybill: '1', type: 'new', gov: '', total: 0, lines: [k], unmapped: [] }] });
    const B = { r: createMemoryRepo(createServerBackend(srv.bootNow(), srv.transport)) };   // B loads now
    await A.r.shipOrders({ refs: ['ZC1'], employee: ADMIN.name, source: 'x' });               // A ships
    await expect(B.r.cancelOrder({ code: 'ZC1', reason: 'x', returnStock: false, photo: photo() })).rejects.toThrow();   // B still thinks it is open
    const sb = await B.r.snapshot();
    expect(sb.orders.find((o: Order) => o.ref === 'ZC1')!.status).toBe('shipped');
    await consistent(srv, B.r);
  });

  it('the automatic close of past days is accepted (any user, past days only)', async () => {
    const { srv, r } = setup(PACK, createFakeServer(boot!, PACK));
    await r.snapshot(); await consistent(srv, r);
  });

  it('a random warehouse day on the live data keeps every rule and reloads identically', async () => {
    const { srv, r } = setup(); let s = await r.snapshot(); const ready = readySkus(s, 4);
    const orders = Array.from({ length: 12 }, (_, i) => ({ ref: `ZR${i}`, waybill: `8${i}`, type: 'new' as const, gov: '', total: 0, lines: [ready[i % ready.length], ready[(i * 7) % ready.length]], unmapped: [] }));
    await r.importPickup({ label: 'يوم', date: T, channel: 'VENDOOR', source: 'x', orders });
    let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < 60; i++) {
      s = await r.snapshot(); const open = s.orders.filter((o) => o.status === 'open' && o.ref.startsWith('ZR')); const { blocked } = allocate(open, s.pickups, s.balances);
      const pick = <X,>(xs: X[]) => xs[Math.floor(rnd() * xs.length)];
      const act = pick(['ship', 'ship', 'cancel', 'restore', 'reverse', 'rtn', 'cln', 'hold'] as const);
      try {
        if (act === 'ship') { const o = pick(open.filter((x) => !blocked.has(x.ref))); if (o) await r.shipOrders({ refs: [o.ref], employee: ADMIN.name, source: 'x' }); }
        if (act === 'cancel') { const o = pick(s.orders.filter((x) => x.ref.startsWith('ZR') && x.status !== 'cancelled')); if (o) await r.cancelOrder({ code: o.ref, reason: 'x', returnStock: rnd() < 0.5, photo: photo() }); }
        if (act === 'restore') { const o = pick(s.orders.filter((x) => x.ref.startsWith('ZR') && x.status === 'cancelled')); if (o) await r.restoreOrder(o.ref); }
        if (act === 'reverse') { const d = pick(s.docs.filter((x) => x.type === 'SCN' && x.status === 'done' && x.date === T)); if (d) await r.reverseShipment(d.no); }
        if (act === 'rtn') { const o = pick(s.orders.filter((x) => x.ref.startsWith('ZR') && x.status === 'shipped' && !x.returned)); if (o) { const e: Record<string, number> = {}; o.lines.forEach((l) => (e[l] = (e[l] ?? 0) + 1)); await r.postOp({ type: 'RTN', date: T, hdr: { refs: [o.ref], counted: true }, lines: Object.keys(e).map((sku) => ({ sku, q: 0, exp: e[sku], r: e[sku], d: 0, x: 0 })) }); } }
        if (act === 'cln') await r.postOp({ type: 'CLN', date: T, hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku: pick(ready), q: 1 }] });
        if (act === 'hold') await r.holdOut({ who: 'x', note: '', reason: 'sample', reasonText: '', lines: [{ sku: pick(ready), q: 1 }], photo: photo() });
      } catch (e) { throw new Error(`step ${i} ${act}: ${(e as Error).message}`); }
      await consistent(srv, r);
    }
  }, 240_000);
});
