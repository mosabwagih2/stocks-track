// Deleting archived pickups that are only copies of another: one copy of every order always stays.
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('./photos', () => ({
  putPhoto: async () => {}, getPhoto: async () => null, clearPhotos: async () => {},
  shrinkImage: async (f: Blob) => f, exportMedia: async () => ({}), replaceMedia: async () => {},
}));

import { createMemoryRepo } from './memory';
import { duplicateArchives } from '@/femini/domain/archiveDup';

type R = ReturnType<typeof createMemoryRepo>;
beforeEach(() => localStorage.clear());

/** archive one pickup, then make two more archived copies of it (as happens when the same file is uploaded and archived again) */
async function withCopies(r: R) {
  const s = await r.snapshot(); const pk = s.pickups.find((p) => s.orders.some((o) => o.pickupId === p.id && o.status === 'open') && !s.orders.some((o) => o.pickupId === p.id && o.status === 'shipped'))!;
  await r.pickupDelete(pk.id);
  const b = await r.exportBackup(); const st = b.state as unknown as { archivedPickups: { pickup: { id: string }; orders: unknown[]; at?: string; by?: string }[] };
  const first = st.archivedPickups.find((a) => a.pickup.id === pk.id)!;
  first.at = '2026-11-15T10:00:00.000Z';
  st.archivedPickups.push({ ...structuredClone(first), pickup: { ...first.pickup, id: 'P901' }, at: '2026-11-17T10:00:00.000Z' }, { ...structuredClone(first), pickup: { ...first.pickup, id: 'P902' }, at: '2026-11-18T10:00:00.000Z' });
  await r.restoreBackup(b);
  return pk.id;
}

it('deletes the later copies, keeps the first, and the orders stay findable', async () => {
  const r = createMemoryRepo(); const orig = await withCopies(r);
  const s = await r.snapshot(); const live = new Set(s.orders.map((o) => o.ref));
  const dups = duplicateArchives(s.archivedPickups, live); expect(dups.map((x) => x.id).sort()).toEqual(['P901', 'P902']);
  const n = await r.deleteArchivedPickups(dups.map((x) => x.id)); expect(n).toBe(2);
  const after = await r.snapshot(); expect(after.archivedPickups.map((a) => a.pickup.id)).toEqual([orig]);
  const refs = after.archivedPickups[0].orders.map((o) => o.ref); expect(refs.length).toBeGreaterThan(0);
});

it('refuses to delete the only holder of an order, an unknown pickup, and an empty list', async () => {
  const r = createMemoryRepo(); const orig = await withCopies(r);
  await expect(r.deleteArchivedPickups(['P901', 'P902', orig])).rejects.toThrow(/مش موجود في أي نسخة تانية/);   // all three at once would leave nobody
  await expect(r.deleteArchivedPickups(['NOPE'])).rejects.toThrow(/غير معروف/);
  await expect(r.deleteArchivedPickups([])).rejects.toThrow(/غير معروف/);
  expect((await r.snapshot()).archivedPickups).toHaveLength(3);                                                  // nothing was deleted by the refusals
});
