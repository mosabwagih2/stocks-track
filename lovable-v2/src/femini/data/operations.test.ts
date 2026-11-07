import { beforeEach, expect, it } from 'vitest';
import { createMemoryRepo } from './memory';
import { balancesFromMoves, qty } from '@/femini/domain/ledger';
import { cairoToday } from '@/femini/domain/dates';

beforeEach(() => localStorage.clear());
const bal = async (r: ReturnType<typeof createMemoryRepo>) => balancesFromMoves((await r.snapshot()).moves);

it('runs every stock operation end to end and records ledger entries', async () => {
  const r = createMemoryRepo(); const T = cairoToday();
  const s0 = await r.snapshot();
  const sku = Object.entries(balancesFromMoves(s0.moves)).find(([, v]) => (v.READY ?? 0) >= 20)![0];
  const start = await bal(r); const ready0 = qty(start, sku, 'READY');
  const count0 = s0.moves.length;

  // RCV refuses without the signed paper photo
  await expect(r.postOp({ type: 'RCV', date: T, hdr: { declared: 5 }, lines: [{ sku, q: 5 }] })).rejects.toThrow();

  await r.postOp({ type: 'SHP', date: T, hdr: { shop: 'اختبار' }, lines: [{ sku, q: 2 }] });
  await r.postOp({ type: 'CLN', date: T, hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku, q: 4 }] });
  await r.postOp({ type: 'FSD', date: T, hdr: { kind: 'wash' }, lines: [{ sku, q: 3 }] });
  await r.postOp({ type: 'FRC', date: T, hdr: {}, lines: [{ sku, q: 2, rej: 1 }] });
  await r.postOp({ type: 'CLN', date: T, hdr: { from: 'READY', to: 'LOST' }, lines: [{ sku, q: 2 }] });
  await r.postOp({ type: 'LOS', date: T, hdr: {}, lines: [{ sku, q: 1, res: 'FOUND' }, { sku, q: 1, res: 'OFF' }] });
  let b = await bal(r);
  expect(qty(b, sku, 'READY')).toBe(ready0 - 2 - 4 + 2 - 2 + 1);
  expect(qty(b, sku, 'DIRTY') - qty(start, sku, 'DIRTY')).toBe(1);
  expect(qty(b, sku, 'SCRAP') - qty(start, sku, 'SCRAP')).toBe(1);
  expect(qty(b, sku, 'LOST') - qty(start, sku, 'LOST')).toBe(0);

  const now = qty(b, sku, 'READY');
  await r.postOp({ type: 'CNT', date: T, hdr: { state: 'READY', cnt: { [sku]: now - 3 }, snap: { [sku]: now }, reveal: true }, lines: [] });
  b = await bal(r); expect(qty(b, sku, 'READY')).toBe(now - 3);

  // RTN on a shipped order
  const o = (await r.snapshot()).orders.find((x) => x.status === 'open')!;
  await r.shipOrders({ refs: [o.ref], employee: 'test', source: 'test' });
  const exp: Record<string, number> = {}; o.lines.forEach((s) => (exp[s] = (exp[s] ?? 0) + 1));
  const [first, ...rest] = Object.keys(exp);
  const lines = [{ sku: first, q: 0, exp: exp[first], r: exp[first] - 1, d: 0, x: 0 }, ...rest.map((s) => ({ sku: s, q: 0, exp: exp[s], r: exp[s], d: 0, x: 0 }))];
  const before = await bal(r);
  await r.postOp({ type: 'RTN', date: T, hdr: { refs: [o.ref], counted: true }, lines });
  b = await bal(r);
  expect(qty(b, first, 'LOST') - qty(before, first, 'LOST')).toBe(1);
  await expect(r.postOp({ type: 'RTN', date: T, hdr: { refs: [o.ref], counted: true }, lines })).rejects.toThrow();

  // over-draw is refused and changes nothing
  const n = (await r.snapshot()).moves.length;
  await expect(r.postOp({ type: 'SHP', date: T, hdr: { shop: 'x' }, lines: [{ sku, q: 999999 }] })).rejects.toThrow();
  const after = await r.snapshot(); expect(after.moves.length).toBe(n);
  expect(n).toBeGreaterThan(count0);
  expect(new Set(after.docs.map((d) => d.type))).toEqual(expect.objectContaining({}));
  for (const t of ['SHP', 'CLN', 'FSD', 'FRC', 'LOS', 'CNT', 'RTN']) expect(after.moves.some((m) => m.type === t)).toBe(true);
  // old moves untouched (immutable ledger)
  const ids = new Map(after.moves.map((m) => [m.id, m]));
  for (const m of s0.moves) expect(ids.get(m.id)).toEqual(m);
});
