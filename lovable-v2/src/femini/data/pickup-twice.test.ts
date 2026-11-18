// The same pickup sheet can never go in twice: not while its pickup is live, and not after it was archived.
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('./photos', () => ({
  putPhoto: async () => {}, getPhoto: async () => null, clearPhotos: async () => {},
  shrinkImage: async (f: Blob) => f, exportMedia: async () => ({}), replaceMedia: async () => {},
}));

import { createMemoryRepo } from './memory';
import { cairoToday } from '@/femini/domain/dates';

type R = ReturnType<typeof createMemoryRepo>;
beforeEach(() => localStorage.clear());
const order = (ref: string, sku: string) => ({ ref, waybill: `9${ref}`, type: 'new' as const, gov: '', total: 0, lines: [sku, sku], unmapped: [] });
const sheet = async (r: R, source: string, refs: string[]) => {
  const sku = (await r.snapshot()).skus[0].id;
  return r.importPickup({ label: 'x', date: cairoToday(), channel: 'VENDOOR', source, orders: refs.map((x) => order(x, sku)) });
};

it('refuses the same file name again while its pickup is live, in any letter case', async () => {
  const r = createMemoryRepo(); await sheet(r, 'بيك اب FEMINI G 29-10-2026.xlsx', ['zz0001', 'zz0002']);
  await expect(sheet(r, 'بيك اب FEMINI G 29-10-2026.xlsx', ['zz0003'])).rejects.toThrow(/الشيت ده اترفع قبل كده/);
  await expect(sheet(r, '  بيك اب femini g 29-10-2026.XLSX ', ['zz0003'])).rejects.toThrow(/الشيت ده اترفع قبل كده/);
  const s = await r.snapshot(); expect(s.orders.some((o) => o.ref === 'zz0003')).toBe(false); expect(s.pickups.filter((p) => p.source.includes('29-10'))).toHaveLength(1);
});

it('refuses it after its pickup was archived too: archiving does not free the sheet', async () => {
  const r = createMemoryRepo(); const { pickup } = await sheet(r, 'a.xlsx', ['zz0001', 'zz0002']);
  await r.pickupDelete(pickup);
  const s = await r.snapshot(); expect(s.archivedPickups.map((a) => a.pickup.id)).toEqual([pickup]);
  await expect(sheet(r, 'a.xlsx', ['zz0001', 'zz0002'])).rejects.toThrow(/مؤرشف/);                // same name
  await expect(sheet(r, 'renamed (1).xlsx', ['zz0001', 'zz0002'])).rejects.toThrow(/موجودة قبل كده/);   // same orders under another name
  const after = await r.snapshot(); expect(after.pickups.some((p) => p.id !== undefined && p.source === 'renamed (1).xlsx')).toBe(false); expect(after.archivedPickups).toHaveLength(1);
});

it('a new sheet with some old orders imports only the new ones; restoring an archived pickup still works', async () => {
  const r = createMemoryRepo(); const { pickup } = await sheet(r, 'a.xlsx', ['zz0001']);
  await r.pickupDelete(pickup);
  const res = await sheet(r, 'b.xlsx', ['zz0001', 'zz0002']);
  expect(res.imported).toBe(1); expect(res.duplicates).toBe(1);                                    // zz0001 is in the archive: not made again
  await r.restoreArchive('pickup', pickup);
  expect((await r.snapshot()).orders.filter((o) => o.ref === 'zz0001')).toHaveLength(1);          // back, once
});

it('the next label never repeats a number used by an archived pickup (checked where the screen builds it)', async () => {
  const { nextPickupLabel } = await import('@/femini/domain/sheetNames');
  const r = createMemoryRepo(); const a = await sheet(r, 'a.xlsx', ['zz0001']); await sheet(r, 'b.xlsx', ['zz0002']);
  await r.pickupDelete(a.pickup);
  const s = await r.snapshot(); const label = nextPickupLabel(s.pickups, s.archivedPickups);
  expect([...s.pickups, ...s.archivedPickups.map((x) => x.pickup)].some((p) => p.label === label)).toBe(false);
});
