// Audit: the repository (the part that writes stock). Each test is a real sequence of work in the warehouse.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./photos', () => ({
  putPhoto: async () => {}, getPhoto: async () => null, clearPhotos: async () => {},
  shrinkImage: async (f: Blob) => f, exportMedia: async () => ({}), replaceMedia: async () => {},
}));

import { createMemoryRepo } from './memory';
import { balancesFromMoves, locTotal, qty } from '@/femini/domain/ledger';
import { addDays, cairoToday } from '@/femini/domain/dates';
import { allocate } from '@/femini/domain/orders';
import { dayReport } from '@/femini/domain/reports';
import type { Order } from '@/femini/domain/types';
import type { Backup } from './backup';

type R = ReturnType<typeof createMemoryRepo>;
const photo = () => new File(['x'], 'p.jpg', { type: 'image/jpeg' });
const snap = (r: R) => r.snapshot();
const B = async (r: R) => balancesFromMoves((await snap(r)).moves);
const READY = async (r: R) => locTotal(await B(r), 'READY');
const order = async (r: R, ref: string) => (await snap(r)).orders.find((o) => o.ref === ref)!;
/** an open order that can ship complete */
const shippable = async (r: R, skip: string[] = []) => {
  const s = await snap(r); const open = s.orders.filter((o) => o.status === 'open');
  const { blocked } = allocate(open, s.pickups, s.balances);
  return open.find((o) => o.lines.length > 1 && !o.unmapped.length && !blocked.has(o.ref) && !skip.includes(o.ref))!;
};
const returnAll = (o: Order) => { const e: Record<string, number> = {}; o.lines.forEach((s) => (e[s] = (e[s] ?? 0) + 1)); return Object.keys(e).map((sku) => ({ sku, q: 0, exp: e[sku], r: e[sku], d: 0, x: 0 })); };
const readySku = async (r: R, min = 5) => Object.entries(await B(r)).find(([, v]) => (v.READY ?? 0) >= min)![0];

beforeEach(() => localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('shipping, cancelling, restoring and reversing stay consistent', () => {
  it('cancel with stock back → restore → reverse the sheet: pieces must not come back twice', async () => {
    const r = createMemoryRepo(); const o = await shippable(r); const base = await READY(r);
    const { doc } = await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' });
    await r.cancelOrder({ code: o.ref, reason: 'x', returnStock: true, photo: photo() });
    await r.restoreOrder(o.ref);                         // order is open again, its pieces are in READY
    expect(await READY(r)).toBe(base);
    await r.reverseShipment(doc);
    expect(await READY(r)).toBe(base);                   // the reversal must not add the pieces a second time
  });

  it('data saved before the fix (restored order still linked to its sheet) does not double count on reversal either', async () => {
    const r = createMemoryRepo(); const o = await shippable(r); const base = await READY(r);
    const { doc } = await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' });
    await r.cancelOrder({ code: o.ref, reason: 'x', returnStock: true, photo: photo() });
    // what the old restoreOrder left behind: open, no cancel record, still pointing at the sheet
    const raw = JSON.parse(localStorage.getItem('femini-web-demo-2')!);
    const old = raw.orders.find((x: Order) => x.ref === o.ref); old.status = 'open'; old.cancel = null;
    localStorage.setItem('femini-web-demo-2', JSON.stringify(raw));
    const r2 = createMemoryRepo();
    await r2.reverseShipment(doc);
    expect(await READY(r2)).toBe(base);
    expect((await order(r2, o.ref)).shipDoc ?? null).toBeNull();
  });

  it('reversing a sheet puts back an order cancelled without its stock, even after its pickup was archived', async () => {
    const r = createMemoryRepo(); const s = await snap(r);
    const sku = s.skus.find((k) => qty(s.balances, k.id, 'READY') >= 2)!.id;
    const { pickup } = await r.importPickup({ label: 't', date: cairoToday(), channel: 'VENDOOR', source: 't', orders: [{ ref: 'AR1', waybill: '1', type: 'new', gov: '', total: 0, lines: [sku, sku], unmapped: [] }] });
    const base = await READY(r);
    const { doc } = await r.shipOrders({ refs: ['AR1'], employee: 'سارة', source: 't' });
    await r.cancelOrder({ code: 'AR1', reason: 'x', returnStock: false, photo: photo() });
    await r.pickupDelete(pickup);
    await r.reverseShipment(doc);
    expect(await READY(r)).toBe(base);
  });

  it('a restored order is open with no link to the old shipment sheet', async () => {
    const r = createMemoryRepo(); const o = await shippable(r);
    await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' });
    await r.cancelOrder({ code: o.ref, reason: 'x', returnStock: true, photo: photo() });
    await r.restoreOrder(o.ref);
    const after = await order(r, o.ref);
    expect(after.status).toBe('open');
    expect(after.shipDoc ?? null).toBeNull();
  });

  it('cancel without stock back → reverse the sheet → restore: order must not be "shipped" while its pieces sit in READY', async () => {
    const r = createMemoryRepo(); const o = await shippable(r); const base = await READY(r);
    const { doc } = await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' });
    await r.cancelOrder({ code: o.ref, reason: 'x', returnStock: false, photo: photo() });
    await r.reverseShipment(doc);
    expect(await READY(r)).toBe(base);                   // reversal put the pieces back
    await r.restoreOrder(o.ref);
    const after = await order(r, o.ref);
    expect(after.status).toBe('open');                   // shipped would count pieces that are still on the shelf
  });

  it('shipping an order that has unmapped items is refused (the missing pieces would never leave the stock)', async () => {
    const r = createMemoryRepo(); const s = await snap(r);
    const sku = s.skus[0].id;
    await r.importPickup({ label: 't', date: cairoToday(), channel: 'VENDOOR', source: 't', orders: [{ ref: 'U1', waybill: '1', type: 'new', gov: '', total: 0, lines: [sku], unmapped: [['ZZZ', 'L', 'احمر', 2]] }] });
    await expect(r.shipOrders({ refs: ['U1'], employee: 'سارة', source: 'تسجيل يدوي' })).rejects.toThrow();
  });

  it('shipping more than READY is allowed but reported (documented behaviour)', async () => {
    const r = createMemoryRepo(); const s = await snap(r);
    const sku = s.skus.find((k) => qty(s.balances, k.id, 'READY') === 0)!.id;
    await r.importPickup({ label: 't', date: cairoToday(), channel: 'VENDOOR', source: 't', orders: [{ ref: 'N1', waybill: '1', type: 'new', gov: '', total: 0, lines: [sku], unmapped: [] }] });
    const res = await r.shipOrders({ refs: ['N1'], employee: 'سارة', source: 't' });
    expect(res.negative).toEqual([{ sku, ready: -1 }]);
  });

  it('a shipment sheet with a customer return and a cancellation reverses cleanly, supplies included', async () => {
    const r = createMemoryRepo(); const a = await shippable(r); const b = await shippable(r, [a.ref]); const c = await shippable(r, [a.ref, b.ref]);
    const base = await READY(r); const sup0 = (await snap(r)).supplyLog.reduce((x, e) => x + e.qty, 0);
    const { doc } = await r.shipOrders({ refs: [a.ref, b.ref, c.ref], employee: 'سارة', source: 't' });
    await r.postOp({ type: 'RTN', date: cairoToday(), hdr: { refs: [a.ref], counted: true }, lines: returnAll(a) });
    await r.cancelOrder({ code: b.ref, reason: 'x', returnStock: true, photo: photo() });
    await r.reverseShipment(doc);
    expect(await READY(r)).toBe(base);
    expect((await order(r, a.ref)).status).toBe('shipped');      // returned order keeps its history
    expect((await order(r, b.ref)).status).toBe('cancelled');
    expect((await order(r, c.ref)).status).toBe('open');
    const sup1 = (await snap(r)).supplyLog.reduce((x, e) => x + e.qty, 0);
    const s = await snap(r); const modelOf = (id: string) => s.skus.find((k) => k.id === id)?.model ?? '';
    const { consumption } = await import('@/femini/domain/supplies');
    const used = consumption(a.lines, s.supplies, modelOf).reduce((x, k) => x + k.qty, 0);
    expect(sup0 - sup1).toBe(used);                              // only the returned order's packaging stays used
  });

  it('a customer return and then cancelling with "stock back" does not return the pieces twice', async () => {
    const r = createMemoryRepo(); const o = await shippable(r); const base = await READY(r);
    await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' });
    await r.postOp({ type: 'RTN', date: cairoToday(), hdr: { refs: [o.ref], counted: true }, lines: returnAll(o) });
    await r.cancelOrder({ code: o.ref, reason: 'x', returnStock: true, photo: photo() });
    expect(await READY(r)).toBe(base);
  });

  it('the same order cannot be returned twice, even in one sheet', async () => {
    const r = createMemoryRepo(); const o = await shippable(r);
    await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' });
    await r.postOp({ type: 'RTN', date: cairoToday(), hdr: { refs: [o.ref], counted: true }, lines: returnAll(o) });
    await expect(r.postOp({ type: 'RTN', date: cairoToday(), hdr: { refs: [o.ref], counted: true }, lines: returnAll(o) })).rejects.toThrow();
  });

  it('cancelling requires the photo of the crossed-out waybill', async () => {
    const r = createMemoryRepo(); const o = await shippable(r);
    await expect(r.cancelOrder({ code: o.ref, reason: 'x', returnStock: false, photo: undefined as unknown as File })).rejects.toThrow();
  });

  it('renaming the scanning employee also moves the pieces in the team report', async () => {
    const r = createMemoryRepo(); const o = await shippable(r);
    const { doc } = await r.shipOrders({ refs: [o.ref], employee: 'غلط', source: 't' });
    await r.renameShipmentEmployee(doc, 'سارة');
    const s = await snap(r);
    const team = dayReport(s, cairoToday()).team.map(([n]) => n);
    expect(team).toContain('سارة');
    expect(team).not.toContain('غلط');
  });
});

describe('team report', () => {
  it('a reversed sheet is taken off the employee who scanned it, not the one who reversed it', async () => {
    const r = createMemoryRepo(); const o = await shippable(r);
    const { doc } = await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' });
    await r.reverseShipment(doc);
    const team = Object.fromEntries(dayReport(await snap(r), cairoToday()).team);
    expect(team['سارة'] ?? 0).toBe(0);
    expect(Object.values(team).every((n) => n >= 0)).toBe(true);
  });
  it('renaming the employee of a sheet on a closed day is refused', async () => {
    const r = createMemoryRepo(); const o = await shippable(r);
    const { doc } = await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' });
    await r.closeDay(cairoToday());
    await expect(r.renameShipmentEmployee(doc, 'منى')).rejects.toThrow(/مقفول/);
  });
});

describe('quantities are always whole pieces and never exceed the shelf', () => {
  it('moving state with the same SKU on two lines cannot take more than exists', async () => {
    const r = createMemoryRepo(); const sku = await readySku(r, 5); const have = qty(await B(r), sku, 'READY');
    await expect(r.moveState({ lines: [{ sku, qty: have }, { sku, qty: have }], from: 'READY', to: 'DIRTY', reason: 'x' })).rejects.toThrow();
  });
  it('moving 2.5 pieces is refused', async () => {
    const r = createMemoryRepo(); const sku = await readySku(r, 5);
    await expect(r.moveState({ lines: [{ sku, qty: 2.5 }], from: 'READY', to: 'DIRTY', reason: 'x' })).rejects.toThrow();
  });
  it('a hold with the same SKU on two lines cannot take more than READY', async () => {
    const r = createMemoryRepo(); const sku = await readySku(r, 5); const have = qty(await B(r), sku, 'READY');
    await expect(r.holdOut({ who: 'x', note: '', reason: 'shoot', reasonText: '', lines: [{ sku, q: have }, { sku, q: have }], photo: photo() })).rejects.toThrow();
  });
  it('receiving with a negative line cannot make the posted total differ from the signed paper', async () => {
    const r = createMemoryRepo(); const s = await snap(r); const [a, b] = s.skus;
    await expect(r.receiveStock({ lines: [{ sku: a.id, qty: 5 }, { sku: b.id, qty: -2 }], date: cairoToday(), ref: 'x', declared: 3, photo: photo() })).rejects.toThrow();
  });
  it('undoing a supply receipt cannot leave a negative supply balance', async () => {
    const r = createMemoryRepo(); await r.supplySave({ name: 'كرتون', unit: 'قطعة', pack: 1, packName: '', minAlert: 0, note: '', rule: { kind: 'none' }, open: 0 });
    const id = (await snap(r)).supplies.at(-1)!.id;
    const rcv = await r.supplyMove({ item: id, kind: 'rcv', qty: 100, why: 'x' });
    await r.supplyMove({ item: id, kind: 'issue', qty: 80, why: 'x' });
    await expect(r.undoSupplyMove(rcv.id)).rejects.toThrow();
  });
  it('supply quantities are whole units', async () => {
    const r = createMemoryRepo(); const id = (await snap(r)).supplies[0].id;
    await expect(r.supplyMove({ item: id, kind: 'rcv', qty: 1.5, why: 'x' })).rejects.toThrow();
  });
});

describe('catalog changes never orphan stock', () => {
  it('a variant with pieces out on hold cannot be removed', async () => {
    const r = createMemoryRepo(); const s = await snap(r);
    const sku = s.skus.find((k) => qty(s.balances, k.id, 'READY') === 2 && !s.orders.some((o) => o.status === 'open' && o.lines.includes(k.id)))
      ?? s.skus.find((k) => qty(s.balances, k.id, 'READY') > 0 && !s.orders.some((o) => o.status === 'open' && o.lines.includes(k.id)))!;
    const have = qty(s.balances, sku.id, 'READY');
    await r.holdOut({ who: 'x', note: '', reason: 'shoot', reasonText: '', lines: [{ sku: sku.id, q: have }], photo: photo() });
    expect(qty(await B(r), sku.id, 'READY')).toBe(0);
    await expect(r.catalogEditModel({ code: sku.model, name: '', add: [], remove: [sku.id] })).rejects.toThrow();
  });
  it('a variant with stock or an open order cannot be removed (control)', async () => {
    const r = createMemoryRepo(); const sku = await readySku(r, 1); const model = (await snap(r)).skus.find((k) => k.id === sku)!.model;
    await expect(r.catalogEditModel({ code: model, name: '', add: [], remove: [sku] })).rejects.toThrow();
  });
  it('a new model with a repeated colour does not create duplicate variants', async () => {
    const r = createMemoryRepo();
    await r.catalogNewModel({ code: 'TST1', name: 'تجربة', colors: ['احمر', 'احمر'], sizes: ['M'], minAlert: 0 });
    const ids = (await snap(r)).skus.filter((k) => k.model === 'TST1').map((k) => k.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('a bundle made here is kept, changed, and removed; a bad one is refused', async () => {
    const r = createMemoryRepo(); const model = (await snap(r)).skus[0].model;
    const mk = (over = {}) => ({ id: 'c-1', title: 'باندل تجربة', type: 'custom', price: 0, was: 0, url: '', available: true, sizes: ['M'], variants: [{ label: '', comps: [{ model, qty: 2, any: true }] }], ...over });
    expect(await r.bundleSave(mk())).toBe('c-1');
    expect((await snap(r)).bundles.map((b) => [b.id, b.title, b.custom])).toEqual([['c-1', 'باندل تجربة', true]]);
    await r.bundleSave(mk({ title: 'اسم جديد' })); expect((await snap(r)).bundles).toHaveLength(1); expect((await snap(r)).bundles[0].title).toBe('اسم جديد');
    await expect(r.bundleSave(mk({ id: 'c-2', title: ' ' }))).rejects.toThrow();
    await expect(r.bundleSave(mk({ id: 'c-2', sizes: [] }))).rejects.toThrow();
    await expect(r.bundleSave(mk({ id: 'c-2', variants: [{ label: '', comps: [{ model: 'NOPE', qty: 1, any: true }] }] }))).rejects.toThrow();
    await expect(r.bundleSave(mk({ id: 'c-2', variants: [{ label: '', comps: [{ model, qty: 0, any: true }] }] }))).rejects.toThrow();
    await r.setModelImage('bundle:c-1', null); await r.bundleRemove('c-1'); expect((await snap(r)).bundles).toHaveLength(0);
    await expect(r.bundleRemove('c-1')).rejects.toThrow();
  });
  it('a new model code that already exists is refused (control)', async () => {
    const r = createMemoryRepo(); const m = (await snap(r)).models[0].code;
    await expect(r.catalogNewModel({ code: m, name: 'x', colors: ['احمر'], sizes: ['M'], minAlert: 0 })).rejects.toThrow();
  });
});

describe('closed days', () => {
  const at = (iso: string) => vi.useFakeTimers({ toFake: ['Date'] }).setSystemTime(new Date(iso));

  it('a closed day refuses every stock operation (control)', async () => {
    const r = createMemoryRepo(); const T = cairoToday(); const sku = await readySku(r, 5); const o = await shippable(r);
    await r.closeDay(T);
    await expect(r.postOp({ type: 'CLN', date: T, hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku, q: 1 }] })).rejects.toThrow(/مقفول/);
    await expect(r.shipOrders({ refs: [o.ref], employee: 'x', source: 't' })).rejects.toThrow(/مقفول/);
    await expect(r.cancelOrder({ code: o.ref, reason: 'x', returnStock: false, photo: photo() })).rejects.toThrow(/مقفول/);
  });

  it('a day closed automatically yesterday can be reopened today and stays open', async () => {
    at('2026-11-05T10:00:00Z');
    const r = createMemoryRepo(); const sku = await readySku(r, 5);
    await r.postOp({ type: 'CLN', date: '2026-11-05', hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku, q: 1 }] });
    at('2026-11-06T10:00:00Z');
    await snap(r);                                                 // auto-closes 11-05 (closed on 11-06)
    expect((await snap(r)).closes.find((c) => c.date === '2026-11-05')?.status).toBe('closed');
    at('2026-11-07T10:00:00Z');
    await r.reopenDay('2026-11-05');
    const s = await snap(r);
    const last = s.closes.filter((c) => c.date === '2026-11-05').at(-1)!;
    expect(last.status).toBe('reopened');
    // and the user can actually post a correction into it
    await expect(r.postOp({ type: 'CLN', date: '2026-11-05', hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku, q: 1 }] })).resolves.toBeTruthy();
  });

  it('reopening a day closed the same day keeps it open (control)', async () => {
    at('2026-11-06T10:00:00Z');
    const r = createMemoryRepo(); const sku = await readySku(r, 5);
    await r.postOp({ type: 'CLN', date: '2026-11-05', hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku, q: 1 }] });
    await snap(r);
    await r.reopenDay('2026-11-05');
    expect((await snap(r)).closes.filter((c) => c.date === '2026-11-05').at(-1)!.status).toBe('reopened');
  });
});

describe('two actions at the same time', () => {
  it('a failing action while a cancellation is saving its photo does not lose the cancellation', async () => {
    const r = createMemoryRepo(); const o = await shippable(r); const base = await READY(r);
    await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' });
    const cancelling = r.cancelOrder({ code: o.ref, reason: 'x', returnStock: true, photo: photo() });
    await expect(r.moveState({ lines: [], from: 'READY', to: 'READY', reason: '' })).rejects.toThrow();   // e.g. a second click elsewhere
    await cancelling;
    const after = await order(r, o.ref);
    expect(after.status).toBe('cancelled');
    expect(await READY(r)).toBe(base);
  });
});

describe('backups', () => {
  it('export → restore gives back exactly the same stock and orders', async () => {
    const r = createMemoryRepo(); const o = await shippable(r);
    await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' });
    const backup = await r.exportBackup(); const before = await snap(r);
    const sku = await readySku(r, 5);
    await r.postOp({ type: 'CLN', date: cairoToday(), hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku, q: 2 }] });
    await r.restoreBackup(backup);
    const after = await snap(r);
    expect(after.balances).toEqual(before.balances);
    expect(after.orders).toEqual(before.orders);
  });
  it('after restoring a backup whose counters are behind, new documents never reuse an existing number', async () => {
    const r = createMemoryRepo(); const sku = await readySku(r, 5);
    await r.postOp({ type: 'CLN', date: cairoToday(), hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku, q: 1 }] });
    const backup = await r.exportBackup();
    (backup.state as { seq: Record<string, number> }).seq = {};
    await r.restoreBackup(backup as Backup);
    await r.postOp({ type: 'CLN', date: cairoToday(), hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku, q: 1 }] });
    const nos = (await snap(r)).docs.map((d) => d.no);
    expect(new Set(nos).size).toBe(nos.length);
  });
});

describe('pickups', () => {
  it('a pickup dated in the future is refused, like when editing one', async () => {
    const r = createMemoryRepo();
    await expect(r.importPickup({ label: 't', date: addDays(cairoToday(), 2), channel: 'VENDOOR', source: 't', orders: [] })).rejects.toThrow();
  });
  it('an archived pickup cannot come back if its orders were imported again (control)', async () => {
    const r = createMemoryRepo(); const s = await snap(r); const sku = s.skus[0].id;
    const { pickup } = await r.importPickup({ label: 't', date: cairoToday(), channel: 'VENDOOR', source: 't', orders: [{ ref: 'Z1', waybill: '9', type: 'new', gov: '', total: 0, lines: [sku], unmapped: [] }] });
    await r.pickupDelete(pickup);
    await r.importPickup({ label: 't2', date: cairoToday(), channel: 'VENDOOR', source: 't', orders: [{ ref: 'Z1', waybill: '9', type: 'new', gov: '', total: 0, lines: [sku], unmapped: [] }] });
    await expect(r.restoreArchive('pickup', pickup)).rejects.toThrow();
  });
});
