import { describe, expect, it } from 'vitest';
import { lostSettlement, shopFlow, shopMix } from './shop';
import { lineOf } from './lines';
import { buildOp } from './ops';
import type { Doc, Move, Sku } from './types';

const skus = [{ id: 'a', model: 'SH2' }, { id: 'b', model: 'BR2' }] as Sku[];
const costs = { SH2: { cost: 50, price: 0 } } as never;   // BR2 has no cost
const mv = (date: string, sku: string, qty: number, from: string, to: string, doc = 'X') => ({ date, sku, qty, from, to, doc }) as unknown as Move;
const doc = (no: string, type: string, date: string, shop?: string, status: 'done' | 'reversed' = 'done') => ({ no, type, date, status, hdr: shop ? { shop } : {}, lines: [] }) as unknown as Doc;

describe('lost pieces', () => {
  it('a lost piece can be found, settled (paid for) or lost for good, each its own move', () => {
    const bal = { a: { LOST: 5 } };
    const r = buildOp('LOS', {}, [{ sku: 'a', q: 1, res: 'FOUND' }, { sku: 'a', q: 2, res: 'COMP' }, { sku: 'a', q: 2, res: 'OFF' }], bal as never, '2026-11-10', '2026-11-10', (s) => s);
    expect(r.moves.map((m) => [m.qty, m.from, m.to])).toEqual([[1, 'LOST', 'READY'], [2, 'LOST', 'EXT_COMP'], [2, 'LOST', 'EXT_OFF']]);
    expect(r.ok).toBe(true);
  });
  it('settled pieces count in money at cost; a model with no cost counts its pieces only', () => {
    const moves = [mv('2026-11-02', 'a', 2, 'LOST', 'EXT_COMP'), mv('2026-11-03', 'b', 1, 'LOST', 'EXT_COMP'), mv('2026-11-03', 'a', 3, 'LOST', 'EXT_OFF'), mv('2026-10-20', 'a', 9, 'LOST', 'EXT_COMP'), mv('2026-11-04', 'a', 1, 'LOST', 'READY')];
    expect(lostSettlement({ skus, archivedSkus: [], costs, moves }, '2026-11-01', '2026-11-30')).toEqual({ comp: { pieces: 3, value: 100, noCost: 1 }, off: { pieces: 3, value: 150, noCost: 0 } });
  });
});

describe('shop supply', () => {
  it('supplies and returns per document and per day at cost, reversed documents left out, what is at the shop now', () => {
    const docs = [doc('SHP-1', 'SHP', '2026-11-02', 'المحل'), doc('SHP-2', 'SHP', '2026-11-04', 'المحل'), doc('SRT-1', 'SRT', '2026-11-05', 'المحل'), doc('SHP-3', 'SHP', '2026-11-05', 'المحل', 'reversed'), doc('SHP-0', 'SHP', '2026-10-01', 'المحل')];
    const moves = [
      mv('2026-11-02', 'a', 10, 'READY', 'EXT_SHOP', 'SHP-1'), mv('2026-11-02', 'b', 4, 'READY', 'EXT_SHOP', 'SHP-1'),
      mv('2026-11-04', 'a', 6, 'READY', 'EXT_SHOP', 'SHP-2'),
      mv('2026-11-05', 'a', 3, 'EXT_SHOP', 'READY', 'SRT-1'), mv('2026-11-05', 'a', 1, 'EXT_SHOP', 'DIRTY', 'SRT-1'),
      mv('2026-11-05', 'a', 50, 'READY', 'EXT_SHOP', 'SHP-3'),
      mv('2026-10-01', 'a', 2, 'READY', 'EXT_SHOP', 'SHP-0'),
    ];
    const r = shopFlow({ skus, archivedSkus: [], costs, moves, docs }, '2026-11-01', '2026-11-07');
    expect(r.docs.map((x) => [x.doc.no, x.kind, x.pieces, x.value, x.noCost])).toEqual([['SRT-1', 'back', 4, 200, 0], ['SHP-2', 'out', 6, 300, 0], ['SHP-1', 'out', 14, 500, 4]]);
    expect(r.docs[0].states).toEqual({ READY: 3, DIRTY: 1 });
    expect(r.out).toEqual({ n: 2, pieces: 20, value: 800, noCost: 4 });
    expect(r.back).toEqual({ n: 1, pieces: 4, value: 200, noCost: 0 });
    expect(r.days.find((x) => x.day === '2026-11-02')).toMatchObject({ out: 14, outValue: 500, back: 0 });
    expect(r.atShop.pieces).toBe(2 + 14 + 6 - 4);   // all time, the reversed supply not included
    expect(r.days).toHaveLength(7);
  });
});

describe('shop mix', () => {
  it('per variant out and back in the dates, the return states, reversed and out-of-range documents left out', () => {
    const docs = [doc('SHP-1', 'SHP', '2026-11-02'), doc('SRT-1', 'SRT', '2026-11-05'), doc('SHP-2', 'SHP', '2026-11-05', '', 'reversed'), doc('SHP-0', 'SHP', '2026-10-01')];
    const moves = [mv('2026-11-02', 'a', 10, 'READY', 'EXT_SHOP', 'SHP-1'), mv('2026-11-02', 'b', 4, 'READY', 'EXT_SHOP', 'SHP-1'), mv('2026-11-05', 'a', 3, 'EXT_SHOP', 'READY', 'SRT-1'), mv('2026-11-05', 'a', 1, 'EXT_SHOP', 'SCRAP', 'SRT-1'), mv('2026-11-05', 'a', 50, 'READY', 'EXT_SHOP', 'SHP-2'), mv('2026-10-01', 'b', 9, 'READY', 'EXT_SHOP', 'SHP-0')];
    const r = shopMix({ moves, docs }, '2026-11-01', '2026-11-07');
    expect(Object.fromEntries(r.bySku)).toEqual({ a: { out: 10, back: 4 }, b: { out: 4, back: 0 } });
    expect(r.backTo).toEqual({ READY: 3, SCRAP: 1 });
  });
  it('the line of a model comes from its code', () => {
    expect(['PAN3', 'BR2', 'SH1', 'D3', 'PAN6 Bundle'].map(lineOf)).toEqual(['بانتي', 'برا', 'شورت', 'موديلات أخرى', 'بانتي']);
  });
});
