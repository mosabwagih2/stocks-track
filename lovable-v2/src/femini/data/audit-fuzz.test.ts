// Audit: integration. Thousands of random but realistic warehouse actions in random order; after every action the whole
// system is checked against rules that must always hold (stock, orders, channel, holds, supplies, documents, catalog).
// A failure prints the rule that broke and the last actions that led there.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./photos', () => ({
  putPhoto: async () => {}, getPhoto: async () => null, clearPhotos: async () => {},
  shrinkImage: async (f: Blob) => f, exportMedia: async () => ({}), replaceMedia: async () => {},
}));

import { createMemoryRepo } from './memory';
import { LOCS } from '@/femini/domain/constants';
import { qty } from '@/femini/domain/ledger';
import { allocate } from '@/femini/domain/orders';
import { cairoToday } from '@/femini/domain/dates';
import { consumption } from '@/femini/domain/supplies';
import { outstanding } from '@/femini/domain/holds';
import type { Order, Snapshot } from '@/femini/domain/types';

type R = ReturnType<typeof createMemoryRepo>;
const photo = () => new File(['x'], 'p.jpg', { type: 'image/jpeg' });

function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

import { violations } from '@/femini/test-utils/invariants';

// ------------------------------------------------------------ random realistic actions
type Act = { name: string; run: () => Promise<unknown> } | null;
function actions(r: R, s: Snapshot, rand: () => number): Record<string, () => Act> {
  const T = cairoToday(); const pick = <X,>(xs: X[]): X | undefined => xs[Math.floor(rand() * xs.length)];
  const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  const inLoc = (l: (typeof LOCS)[number]) => Object.keys(s.balances).filter((k) => qty(s.balances, k, l) > 0 && s.skus.some((x) => x.id === k));
  const open = s.orders.filter((o) => o.status === 'open'); const { blocked } = allocate(open, s.pickups, s.balances);
  return {
    ship: () => { const ok = open.filter((o) => !blocked.has(o.ref) && !o.unmapped.length && o.lines.length); if (!ok.length) return null; const refs = [...new Set([pick(ok)!, pick(ok)!].map((o) => o.ref))].slice(0, int(1, 2)); return { name: `ship ${refs}`, run: () => r.shipOrders({ refs, employee: pick(['سارة', 'منى'])!, source: 't' }) }; },
    reverse: () => { const d = pick(s.docs.filter((x) => x.type === 'SCN' && x.status === 'done')); return d ? { name: `reverse ${d.no}`, run: () => r.reverseShipment(d.no) } : null; },
    cancel: () => { const o = pick(s.orders.filter((x) => x.status !== 'cancelled')); if (!o) return null; const back = rand() < 0.5; return { name: `cancel ${o.ref}${back ? ' +stock' : ''} (${o.status})`, run: () => r.cancelOrder({ code: o.ref, reason: 'x', returnStock: back, photo: photo() }) }; },
    restore: () => { const o = pick(s.orders.filter((x) => x.status === 'cancelled')); return o ? { name: `restore ${o.ref}`, run: () => r.restoreOrder(o.ref) } : null; },
    rtn: () => {
      const o = pick(s.orders.filter((x) => x.status === 'shipped' && !x.returned)); if (!o) return null;
      const e: Record<string, number> = {}; o.lines.forEach((k) => (e[k] = (e[k] ?? 0) + 1));
      const lines = Object.keys(e).map((sku) => { let left = e[sku] - (rand() < 0.3 ? 1 : 0); const rr = int(0, left); left -= rr; const d = int(0, left); left -= d; return { sku, q: 0, exp: e[sku], r: rr, d, x: left }; });
      return { name: `return ${o.ref}`, run: () => r.postOp({ type: 'RTN', date: T, hdr: { refs: [o.ref], counted: true }, lines }) };
    },
    cln: () => { const k = pick(inLoc('READY')); return k ? { name: `CLN ${k}`, run: () => r.postOp({ type: 'CLN', date: T, hdr: { from: 'READY', to: pick(['DIRTY', 'SCRAP', 'LOST'] as const)! }, lines: [{ sku: k, q: int(1, Math.min(2, qty(s.balances, k, 'READY'))) }] }) } : null; },
    fsd: () => { const k = pick(inLoc('DIRTY')); return k ? { name: `FSD ${k}`, run: () => r.postOp({ type: 'FSD', date: T, hdr: { kind: 'wash' }, lines: [{ sku: k, q: int(1, qty(s.balances, k, 'DIRTY')) }] }) } : null; },
    frc: () => { const k = pick(inLoc('FACTORY')); if (!k) return null; const f = qty(s.balances, k, 'FACTORY'); const q = int(0, f); return { name: `FRC ${k}`, run: () => r.postOp({ type: 'FRC', date: T, hdr: {}, lines: [{ sku: k, q, rej: int(0, f - q) }] }) }; },
    los: () => { const k = pick(inLoc('LOST')); return k ? { name: `LOS ${k}`, run: () => r.postOp({ type: 'LOS', date: T, hdr: {}, lines: [{ sku: k, q: 1, res: rand() < 0.5 ? 'FOUND' : 'OFF' }] }) } : null; },
    shp: () => { const k = pick(inLoc('READY')); return k ? { name: `SHP ${k}`, run: () => r.postOp({ type: 'SHP', date: T, hdr: { shop: 'المحل' }, lines: [{ sku: k, q: 1 }] }) } : null; },
    cnt: () => { const k = pick(inLoc('READY')); if (!k) return null; const now = qty(s.balances, k, 'READY'); const c = Math.max(0, now + int(-2, 2)); return { name: `CNT ${k} ${now}->${c}`, run: () => r.postOp({ type: 'CNT', date: T, hdr: { state: 'READY', cnt: { [k]: c }, snap: { [k]: now }, reveal: true }, lines: [] }) }; },
    swp: () => { const a = pick(inLoc('READY')); const b2 = pick(s.skus)?.id; return a && b2 && a !== b2 ? { name: `SWP ${a}->${b2}`, run: () => r.postOp({ type: 'SWP', date: T, hdr: {}, lines: [{ sku: a, q: 1, to: b2 }] }) } : null; },
    holdOut: () => { const k = pick(inLoc('READY')); return k ? { name: `hold out ${k}`, run: () => r.holdOut({ who: 'مصورة', note: '', reason: 'shoot', reasonText: '', lines: [{ sku: k, q: int(1, Math.min(2, qty(s.balances, k, 'READY'))) }], photo: photo() }) } : null; },
    holdSettle: () => {
      const h = pick(s.holds.filter((x) => x.status === 'open')); if (!h) return null; const left = outstanding(h);
      const ret: { sku: string; q: number; to: 'READY' | 'DIRTY' }[] = []; const off: { sku: string; q: number }[] = [];
      for (const [sku, q] of Object.entries(left)) { const a = int(0, q); ret.push({ sku, q: a, to: rand() < 0.7 ? 'READY' : 'DIRTY' }); off.push({ sku, q: int(0, q - a) }); }
      return { name: `hold settle ${h.no}`, run: () => r.holdSettle({ no: h.no, ret, off, note: '', photo: photo() }) };
    },
    supply: () => { const it = pick(s.supplies); if (!it) return null; const kind = pick(['rcv', 'issue', 'count'] as const)!; return { name: `supply ${kind} ${it.id}`, run: () => r.supplyMove({ item: it.id, kind, qty: int(1, 50), why: 'x' }) }; },
    supplyUndo: () => { const e = pick(s.supplyLog.filter((x) => ['rcv', 'issue', 'count'].includes(x.kind) && !x.reversed)); return e ? { name: `supply undo ${e.id}`, run: () => r.undoSupplyMove(e.id) } : null; },
    pickup: () => {
      const ready = inLoc('READY'); if (!ready.length) return null; const n = int(1, 3); const base = `F${Math.floor(rand() * 1e9)}`;
      const orders = Array.from({ length: n }, (_, i) => ({ ref: `${base}${i}`, waybill: `${base}${i}W`, type: 'new' as const, gov: '', total: 0, lines: Array.from({ length: int(1, 3) }, () => pick(ready)!), unmapped: [] }));
      return { name: `import pickup ${n} orders`, run: () => r.importPickup({ label: 'ف', date: T, channel: 'VENDOOR', source: 't', orders }) };
    },
    pickupDelete: () => { const p = pick(s.pickups); return p ? { name: `delete pickup ${p.id}`, run: () => r.pickupDelete(p.id) } : null; },
    pickupRestore: () => { const a = pick(s.archivedPickups); return a ? { name: `restore pickup ${a.pickup.id}`, run: () => r.restoreArchive('pickup', a.pickup.id) } : null; },
    catalogRemove: () => { const k = pick(s.skus); return k ? { name: `remove variant ${k.id}`, run: () => r.catalogEditModel({ code: k.model, name: '', add: [], remove: [k.id] }) } : null; },
    rename: () => { const d = pick(s.docs.filter((x) => x.type === 'SCN')); return d ? { name: `rename ${d.no}`, run: () => r.renameShipmentEmployee(d.no, 'هبة') } : null; },
    bad: () => { const k = pick(inLoc('READY')); return k ? { name: `invalid CLN ${k}`, run: () => r.postOp({ type: 'CLN', date: T, hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku: k, q: qty(s.balances, k, 'READY') + 1 }] }) } : null; },
  };
}

const WEIGHTS: Record<string, number> = { ship: 6, reverse: 2, cancel: 3, restore: 2, rtn: 3, cln: 2, fsd: 1, frc: 1, los: 1, shp: 1, cnt: 1, swp: 1, holdOut: 2, holdSettle: 2, supply: 1, supplyUndo: 1, pickup: 2, pickupDelete: 1, pickupRestore: 1, catalogRemove: 1, rename: 1, bad: 1 };

async function campaign(seeds: number, steps: number, exclude: string[]) {
  const found = new Map<string, { seed: number; trail: string[] }>(); let ok = 0; let refused = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    localStorage.clear(); const r = createMemoryRepo(); const rand = rng(seed); const trail: string[] = []; const seen = new Set<string>();
    for (let i = 0; i < steps; i++) {
      const s = await r.snapshot(); const acts = actions(r, s, rand);
      const names = Object.keys(WEIGHTS).filter((n) => !exclude.includes(n)).flatMap((n) => Array(WEIGHTS[n]).fill(n));
      const a = acts[names[Math.floor(rand() * names.length)]](); if (!a) continue;
      const before = JSON.stringify([s.moves.length, s.orders, s.docs.length, s.supplyLog.length, s.holds]);
      try { await a.run(); ok++; trail.push(a.name); }
      catch (e) {
        refused++; trail.push(`${a.name} ✗ ${(e as Error).message.slice(0, 50)}`);
        const s2 = await r.snapshot();
        if (JSON.stringify([s2.moves.length, s2.orders, s2.docs.length, s2.supplyLog.length, s2.holds]) !== before) { const k = 'a refused action still changed data'; if (!found.has(k)) found.set(k, { seed, trail: trail.slice(-6) }); }
      }
      for (const v of violations(await r.snapshot())) if (!seen.has(v)) { seen.add(v); if (!found.has(v)) found.set(v, { seed, trail: trail.slice(-8) }); }
    }
  }
  return { found, ok, refused };
}

beforeEach(() => localStorage.clear());

describe('integration: random warehouse days keep every rule', () => {
  it('rule checker sees a clean starting system', async () => {
    expect(violations(await createMemoryRepo().snapshot())).toEqual([]);
  });

  it.each([
    ['all actions', []],
    ['without restoring cancelled orders and removing variants (to surface other problems)', ['restore', 'catalogRemove']],
  ])('%s', async (_n, exclude) => {
    const { found, ok, refused } = await campaign(30, 90, exclude as string[]);
    const report = [...found].map(([rule, x]) => `✗ ${rule}\n   seed ${x.seed}, last actions:\n   - ${x.trail.join('\n   - ')}`);
    console.log(`[fuzz:${_n}] ${ok} actions done, ${refused} refused by validation\n${report.join('\n') || 'no rule broken'}`);
    expect([...found.keys()]).toEqual([]);
  }, 240_000);
});
