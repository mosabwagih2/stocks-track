// A confirmed customer return can be opened again to correct it: undone on its own day, then re-confirmed.
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('./photos', () => ({
  putPhoto: async () => {}, getPhoto: async () => null, clearPhotos: async () => {},
  shrinkImage: async (f: Blob) => f, exportMedia: async () => ({}), replaceMedia: async () => {},
}));

import { createMemoryRepo } from './memory';
import { balancesFromMoves, locTotal } from '@/femini/domain/ledger';
import { cairoToday } from '@/femini/domain/dates';
import { allocate } from '@/femini/domain/orders';
import { returnLines, type OpLine } from '@/femini/domain/ops';
import type { Order } from '@/femini/domain/types';

type R = ReturnType<typeof createMemoryRepo>;
beforeEach(() => localStorage.clear());
const tot = async (r: R, loc: 'READY' | 'DIRTY' | 'SCRAP' | 'LOST') => locTotal(balancesFromMoves((await r.snapshot()).moves), loc);
const shipped = async (r: R) => {
  const s = await r.snapshot(); const open = s.orders.filter((o) => o.status === 'open'); const { blocked } = allocate(open, s.pickups, s.balances);
  const o = open.find((x) => x.lines.length > 1 && !x.unmapped.length && !blocked.has(x.ref))!;
  await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' }); return o;
};
const confirm = (r: R, o: Order, hdr: Record<string, unknown>, lines: OpLine[]) => r.postOp({ type: 'RTN', date: cairoToday(), hdr: { refs: [o.ref], counted: true, ...hdr }, lines });

it('opening a confirmed return puts the stock back, frees the orders, and hands back a draft with what it held', async () => {
  const r = createMemoryRepo(); const o = await shipped(r);
  const base = { ready: await tot(r, 'READY'), dirty: await tot(r, 'DIRTY'), lost: await tot(r, 'LOST') };
  const marks = { [o.ref]: { [o.lines[0]]: { d: 1 } } };
  const { doc } = await confirm(r, o, { marks, sheets: ['مرتجعات Femini G 11-11-2026.xlsx'] }, returnLines([o], marks));
  expect((await tot(r, 'READY')) - base.ready).toBe(o.lines.length - 1); expect((await tot(r, 'DIRTY')) - base.dirty).toBe(1);
  expect((await r.snapshot()).orders.find((x) => x.ref === o.ref)!.returned?.doc).toBe(doc);

  const { draft } = await r.reopenReturn(doc);
  const s = await r.snapshot();
  expect(await tot(r, 'READY')).toBe(base.ready); expect(await tot(r, 'DIRTY')).toBe(base.dirty);          // as if it never happened
  expect(s.orders.find((x) => x.ref === o.ref)!.returned).toBeFalsy();
  expect(s.docs.find((x) => x.no === doc)!.status).toBe('reversed');
  const dr = (s.drafts ?? []).find((x) => x.id === draft)!;
  expect(dr).toMatchObject({ type: 'RTN', hdr: { refs: [o.ref], marks, sheets: ['مرتجعات Femini G 11-11-2026.xlsx'], counted: false, editOf: doc } });
  expect(dr.lines.length).toBeGreaterThan(0);

  // corrected: this time all of it sound, and confirmed again
  await confirm(r, o, { editOf: doc }, returnLines([o], {}));
  expect((await tot(r, 'READY')) - base.ready).toBe(o.lines.length); expect((await tot(r, 'DIRTY')) - base.dirty).toBe(0);
  await expect(r.reopenReturn(doc)).rejects.toThrow(/اتعكس/);                                           // the old one stays reversed, once
});

it('refused: a day that is closed, pieces already moved on, and a document that is not a return', async () => {
  const r = createMemoryRepo(); const o = await shipped(r);
  const { doc } = await confirm(r, o, {}, returnLines([o], {}));
  await r.closeDay(cairoToday());
  await expect(r.reopenReturn(doc)).rejects.toThrow(/مقفول/);
  await r.reopenDay(cairoToday());
  // the pieces leave the shelf again (cleaning): they cannot be taken back out of the return
  const sku = o.lines[0]; const have = (await r.snapshot()).balances[sku]?.READY ?? 0;
  await r.postOp({ type: 'CLN', date: cairoToday(), hdr: { from: 'READY', to: 'DIRTY', reason: 't' }, lines: [{ sku, q: have }] });
  await expect(r.reopenReturn(doc)).rejects.toThrow(/القطع اتحركت/);
  await expect(r.reopenReturn('NOPE-1')).rejects.toThrow(/غير معروف/);
});

it('a stock that was already negative before the return can still be opened (undoing puts it back exactly where it was)', async () => {
  const r = createMemoryRepo(); const s0 = await r.snapshot(); const open = s0.orders.filter((o) => o.status === 'open' && o.lines.length > 1 && !o.unmapped.length);
  const o = open[0]; const sku = o.lines[0]; const ready = s0.balances[sku]?.READY ?? 0;
  if (ready > 0) await r.postOp({ type: 'CLN', date: cairoToday(), hdr: { from: 'READY', to: 'DIRTY', reason: 't' }, lines: [{ sku, q: ready }] });   // nothing left on the shelf
  await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' });                                                                          // shipped anyway: the stock goes negative
  const neg = (await r.snapshot()).balances[sku]?.READY ?? 0; expect(neg).toBeLessThan(0);
  const { doc } = await confirm(r, o, {}, returnLines([o], {}));
  await r.reopenReturn(doc);
  expect((await r.snapshot()).balances[sku]?.READY ?? 0).toBe(neg);
});
