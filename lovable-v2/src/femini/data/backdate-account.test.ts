// Forgotten uploads on a past day, re-linking unrecognised Vendoor codes, and the signed-in account as "who did it".
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./photos', () => ({
  putPhoto: async () => {}, getPhoto: async () => null, clearPhotos: async () => {},
  shrinkImage: async (f: Blob) => f, exportMedia: async () => ({}), replaceMedia: async () => {},
}));

import { createMemoryRepo } from './memory';
import { DEFAULT_ACTOR, setActor } from './repo';
import { balancesFromMoves, qty } from '@/femini/domain/ledger';
import { addDays, cairoDay, cairoToday } from '@/femini/domain/dates';
import { allocate } from '@/femini/domain/orders';
import { dayReport } from '@/femini/domain/reports';
import { parsePickupRows } from '@/femini/domain/pickup';
import type { Order, Sku } from '@/femini/domain/types';

type R = ReturnType<typeof createMemoryRepo>;
const snap = (r: R) => r.snapshot();
const order = async (r: R, ref: string) => (await snap(r)).orders.find((o) => o.ref === ref)!;
const yesterday = () => addDays(cairoToday(), -1);
const newOrder = async (r: R, ref: string, date: string) => {
  const s = await snap(r); const sku = s.skus.find((k) => qty(s.balances, k.id, 'READY') >= 3)!.id;
  await r.importPickup({ label: 'نسيته', date, channel: 'VENDOOR', source: 't', orders: [{ ref, waybill: `${ref}W`, type: 'new', gov: '', total: 0, lines: [sku, sku], unmapped: [] }] });
  return sku;
};

beforeEach(() => localStorage.clear());
afterEach(() => setActor(null));

describe('forgotten uploads: pickup and scan on a past day', () => {
  it('a pickup of yesterday is recorded on yesterday', async () => {
    const r = createMemoryRepo(); await newOrder(r, 'Y1', yesterday());
    const s = await snap(r); const o = s.orders.find((x) => x.ref === 'Y1')!;
    expect(s.pickups.find((p) => p.id === o.pickupId)!.date).toBe(yesterday());
  });
  it('more than 7 days back or in the future is refused', async () => {
    const r = createMemoryRepo();
    await expect(r.importPickup({ label: 'x', date: addDays(cairoToday(), -8), channel: 'VENDOOR', source: 't', orders: [] })).rejects.toThrow(/7/);
    await expect(r.importPickup({ label: 'x', date: addDays(cairoToday(), 1), channel: 'VENDOOR', source: 't', orders: [] })).rejects.toThrow(/المستقبل/);
    await expect(r.importPickup({ label: 'x', date: addDays(cairoToday(), -7), channel: 'VENDOOR', source: 't', orders: [] })).resolves.toBeTruthy();
  });
  it("a scan of yesterday takes the stock out on yesterday and counts in yesterday's report", async () => {
    const r = createMemoryRepo(); const sku = await newOrder(r, 'Y2', yesterday());
    const before = qty(balancesFromMoves((await snap(r)).moves), sku, 'READY');
    const { doc } = await r.shipOrders({ refs: ['Y2'], employee: 'سارة', source: 't', date: yesterday() });
    const s = await snap(r);
    expect(qty(s.balances, sku, 'READY')).toBe(before - 2);
    expect(s.moves.filter((m) => m.doc === doc).every((m) => m.date === yesterday())).toBe(true);
    expect(s.docs.find((x) => x.no === doc)!.date).toBe(yesterday());
    expect(cairoDay(s.orders.find((o) => o.ref === 'Y2')!.shippedAt!)).toBe(yesterday());
    expect(s.supplyLog.filter((e) => e.doc === doc).every((e) => e.date === yesterday())).toBe(true);
    expect(dayReport(s, yesterday()).summary.shipped).toBe(2);
    expect(Object.fromEntries(dayReport(s, yesterday()).team)['سارة']).toBe(2);
    expect(dayReport(s, cairoToday()).summary.shipped).toBe(0);
  });
  it('a closed past day must be reopened first, then the upload works', async () => {
    const r = createMemoryRepo(); await r.closeDay(yesterday());
    await expect(newOrder(r, 'Y3', yesterday())).rejects.toThrow(/مقفول/);
    await r.reopenDay(yesterday());
    await newOrder(r, 'Y3', yesterday());
    await expect(r.shipOrders({ refs: ['Y3'], employee: 'سارة', source: 't', date: yesterday() })).resolves.toBeTruthy();
  });
  it('an order cannot be shipped on a day before its pickup', async () => {
    const r = createMemoryRepo(); await newOrder(r, 'Y4', cairoToday());
    await expect(r.shipOrders({ refs: ['Y4'], employee: 'سارة', source: 't', date: yesterday() })).rejects.toThrow();
  });
  it('a scan with no date still goes on today (unchanged behaviour)', async () => {
    const r = createMemoryRepo(); await newOrder(r, 'Y5', cairoToday());
    const { doc } = await r.shipOrders({ refs: ['Y5'], employee: 'سارة', source: 't' });
    expect((await snap(r)).docs.find((x) => x.no === doc)!.date).toBe(cairoToday());
  });
});

describe('Vendoor codes that were not recognised', () => {
  it('"Women A6" items are linked to model A6 later, and the order can then ship', async () => {
    const r = createMemoryRepo(); const s = await snap(r);
    const k = s.skus.find((x) => x.model === 'A6' && qty(s.balances, x.id, 'READY') >= 2)!;
    await r.importPickup({ label: 't', date: cairoToday(), channel: 'VENDOOR', source: 't', orders: [{ ref: 'W6', waybill: '6', type: 'new', gov: '', total: 0, lines: [], unmapped: [['Women A6', k.size, k.color, 2]] }] });
    await expect(r.shipOrders({ refs: ['W6'], employee: 'سارة', source: 't' })).rejects.toThrow();
    expect(await r.remapUnmapped()).toBe(1);
    const o = await order(r, 'W6');
    expect(o.lines).toEqual([k.id, k.id]); expect(o.unmapped).toEqual([]);
    await expect(r.shipOrders({ refs: ['W6'], employee: 'سارة', source: 't' })).resolves.toBeTruthy();
  });
  it('a code that is still unknown stays unmapped (nothing guessed)', async () => {
    const r = createMemoryRepo();
    await r.importPickup({ label: 't', date: cairoToday(), channel: 'VENDOOR', source: 't', orders: [{ ref: 'WX', waybill: '7', type: 'new', gov: '', total: 0, lines: [], unmapped: [['ZZZ9', 'L', 'احمر', 1]] }] });
    expect(await r.remapUnmapped()).toBe(0);
    expect((await order(r, 'WX')).unmapped.length).toBe(1);
  });
  it('adding the missing model to the catalog links waiting orders by itself', async () => {
    const r = createMemoryRepo();
    await r.importPickup({ label: 't', date: cairoToday(), channel: 'VENDOOR', source: 't', orders: [{ ref: 'WN', waybill: '8', type: 'new', gov: '', total: 0, lines: [], unmapped: [['Women NEW1', 'M', 'احمر', 1]] }] });
    await r.catalogNewModel({ code: 'NEW1', name: 'بدي', colors: ['احمر'], sizes: ['M'], minAlert: 0 });
    const o = await order(r, 'WN');
    expect(o.unmapped).toEqual([]); expect(o.lines.length).toBe(1);
  });
  it('a shipped order is never re-linked (its stock already left without those pieces)', async () => {
    const r = createMemoryRepo(); const s0 = await snap(r); const k = s0.skus.find((x) => x.model === 'A6')!;
    const open = s0.orders.filter((o) => o.status === 'open'); const { blocked } = allocate(open, s0.pickups, s0.balances);
    const o = open.find((x) => !blocked.has(x.ref) && x.lines.length)!;
    await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' });
    const st = JSON.parse(localStorage.getItem('femini-web-demo-2')!); st.orders.find((x: Order) => x.ref === o.ref).unmapped = [['Women A6', k.size, k.color, 1]];
    localStorage.setItem('femini-web-demo-2', JSON.stringify(st));
    expect(await createMemoryRepo().remapUnmapped()).toBe(0);
  });
  it('the sheet parser maps "Women A6", "Women A9" and "FC-BR2"; an unknown "Women X" stays unknown', () => {
    const skus: Sku[] = [{ id: 'A6-RED-M', model: 'A6', color: 'احمر', size: 'M', minAlert: 0 }, { id: 'A9-BLK-L', model: 'A9', color: 'اسود', size: 'L', minAlert: 0 }, { id: 'BR2-BLK-L', model: 'BR2', color: 'اسود', size: 'L', minAlert: 0 }];
    const head = ['كود الاوردر العشوائي', 'بوليصة الشحن', 'حالة الاوردر الجزئية', 'المحافظة', 'المبلغ توتال بالشحن للاوردر', 'المنتجات المطلوبة في الاوردر'];
    const r = parsePickupRows([head, ['o1', 1, '', '', 0, 'Women A6 ( بدي )-M-احمر-1, Women A9 ( بدي )-L-اسود-2, FC-BR2 ( برا )-L-اسود-1, Women A77 ( بدي )-M-احمر-1']], skus, new Set());
    expect(r.orders[0].lines).toEqual(['A6-RED-M', 'A9-BLK-L', 'A9-BLK-L', 'BR2-BLK-L']);
    expect(r.unknownModels).toEqual(['Women A77']);
  });
});

describe('who did it = the signed-in account', () => {
  it('operations are recorded under the account name, and the default when signed out', async () => {
    const r = createMemoryRepo(); const s = await snap(r); const sku = s.skus.find((k) => qty(s.balances, k.id, 'READY') >= 5)!.id;
    setActor('سارة أحمد');
    const a = await r.postOp({ type: 'CLN', date: cairoToday(), hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku, q: 1 }] });
    setActor(null);
    const b = await r.postOp({ type: 'CLN', date: cairoToday(), hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku, q: 1 }] });
    const s2 = await snap(r);
    expect(s2.docs.find((d) => d.no === a.doc)!.by).toBe('سارة أحمد');
    expect(s2.moves.filter((m) => m.doc === a.doc).every((m) => m.by === 'سارة أحمد')).toBe(true);
    expect(s2.docs.find((d) => d.no === b.doc)!.by).toBe(DEFAULT_ACTOR);
  });
});
