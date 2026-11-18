// A customer return keeps the sheets it was made from, like pickups and shipping keep theirs.
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('./photos', () => ({
  putPhoto: async () => {}, getPhoto: async () => null, clearPhotos: async () => {},
  shrinkImage: async (f: Blob) => f, exportMedia: async () => ({}), replaceMedia: async () => {},
}));

import { createMemoryRepo } from './memory';
import { cairoToday } from '@/femini/domain/dates';
import { allocate } from '@/femini/domain/orders';
import { returnLines } from '@/femini/domain/ops';

beforeEach(() => localStorage.clear());

it('confirming a return with sheets keeps each sheet as an original owned by the return', async () => {
  const r = createMemoryRepo(); const s = await r.snapshot(); const open = s.orders.filter((o) => o.status === 'open'); const { blocked } = allocate(open, s.pickups, s.balances);
  const o = open.find((x) => x.lines.length > 1 && !x.unmapped.length && !blocked.has(x.ref))!;
  await r.shipOrders({ refs: [o.ref], employee: 'سارة', source: 't' });
  const a = new File(['a'], 'مرتجعات Femini G 11-11-2026.xlsx', { type: 'application/vnd.ms-excel' }); const b = new File(['b'], 'مرتجعات تانية.xlsx', { type: 'application/vnd.ms-excel' });
  const { doc } = await r.postOp({ type: 'RTN', date: cairoToday(), hdr: { refs: [o.ref], counted: true, sheets: [a.name, b.name] }, lines: returnLines([o], {}), sheets: [a, b] });
  const files = (await r.snapshot()).files.filter((f) => f.owner === doc);
  expect(files.map((f) => [f.kind, f.name])).toEqual([['sheet', a.name], ['sheet', b.name]]);
  const d = (await r.snapshot()).docs.find((x) => x.no === doc)!;
  expect(d.hdr.sheets).toEqual([a.name, b.name]);
});

it('only a customer return keeps sheets: another operation ignores them', async () => {
  const r = createMemoryRepo(); const s = await r.snapshot();
  const sku = Object.keys(s.balances).find((k) => (s.balances[k]?.READY ?? 0) >= 2)!;
  const { doc } = await r.postOp({ type: 'CLN', date: cairoToday(), hdr: { from: 'READY', to: 'DIRTY', reason: 't' }, lines: [{ sku, q: 1 }], sheets: [new File(['x'], 'x.xlsx')] });
  expect((await r.snapshot()).files.filter((f) => f.owner === doc)).toEqual([]);
});
