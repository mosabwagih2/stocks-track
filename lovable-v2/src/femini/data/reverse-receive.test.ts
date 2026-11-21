// A receipt recorded by mistake is undone on its own day: stock back as before, the document stays as «reversed».
import { beforeEach, expect, it, vi } from 'vitest';

vi.mock('./photos', () => ({
  putPhoto: async () => {}, getPhoto: async () => null, clearPhotos: async () => {},
  shrinkImage: async (f: Blob) => f, exportMedia: async () => ({}), replaceMedia: async () => {},
}));

import { createMemoryRepo } from './memory';
import { balancesFromMoves, qty } from '@/femini/domain/ledger';
import { cairoToday } from '@/femini/domain/dates';

type R = ReturnType<typeof createMemoryRepo>;
beforeEach(() => localStorage.clear());
const photo = () => new File(['x'], 'p.jpg', { type: 'image/jpeg' });
const ready = async (r: R, sku: string) => qty(balancesFromMoves((await r.snapshot()).moves), sku, 'READY');

it('undoes a receipt on its own day: READY back as before, the document stays marked reversed, only once', async () => {
  const r = createMemoryRepo(); const [a, b] = (await r.snapshot()).skus; const day = cairoToday();
  const before = { a: await ready(r, a.id), b: await ready(r, b.id) };
  const { doc } = await r.receiveStock({ lines: [{ sku: a.id, qty: 5 }, { sku: b.id, qty: 3 }], date: day, ref: 'غلط', declared: 8, photo: photo() });
  expect(await ready(r, a.id)).toBe(before.a + 5);

  expect(await r.reverseReceive(doc)).toEqual({ pieces: 8 });
  const s = await r.snapshot();
  expect(await ready(r, a.id)).toBe(before.a); expect(await ready(r, b.id)).toBe(before.b);
  expect(s.docs.find((x) => x.no === doc)!.status).toBe('reversed');
  const rev = s.moves.filter((m) => m.doc === `${doc} (عكس)`);
  expect(rev.map((m) => [m.from, m.to, m.date])).toEqual([['READY', 'EXT_FACTORY', day], ['READY', 'EXT_FACTORY', day]]);   // on the receipt's day
  await expect(r.reverseReceive(doc)).rejects.toThrow(/اتعكس/);
});

it('refused: a closed day, pieces already moved on, and a document that is not a receipt', async () => {
  const r = createMemoryRepo(); const [a] = (await r.snapshot()).skus;
  const { doc } = await r.receiveStock({ lines: [{ sku: a.id, qty: 4 }], date: cairoToday(), ref: 'x', declared: 4, photo: photo() });
  await r.closeDay(cairoToday());
  await expect(r.reverseReceive(doc)).rejects.toThrow(/مقفول/);
  await r.reopenDay(cairoToday());
  const have = await ready(r, a.id);
  await r.postOp({ type: 'CLN', date: cairoToday(), hdr: { from: 'READY', to: 'DIRTY', reason: 't' }, lines: [{ sku: a.id, q: have }] });
  await expect(r.reverseReceive(doc)).rejects.toThrow(/القطع اتحركت/);
  await expect(r.reverseReceive('NOPE-1')).rejects.toThrow(/غير معروف/);
});
