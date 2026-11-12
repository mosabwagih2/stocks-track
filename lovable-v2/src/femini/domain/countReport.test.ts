import { describe, expect, it } from 'vitest';
import { countReport } from './countReport';
import type { Doc, Move, Sku } from './types';

const skus = [{ id: 'a', model: 'SH2' }, { id: 'b', model: 'SH2' }, { id: 'c', model: 'BR2' }] as Sku[];
const costs = { SH2: { cost: 50, price: 0 } } as never;
const mv = (doc: string, sku: string, qty: number, from: string, to: string) => ({ date: '2026-11-05', sku, qty, from, to, doc, type: 'CNT' }) as unknown as Move;
const cnt = (no: string, date: string, c: Record<string, number>, snap: Record<string, number>, status: 'done' | 'reversed' = 'done') => ({ no, type: 'CNT', date, status, hdr: { state: 'READY', cnt: c, snap }, lines: [] }) as unknown as Doc;

describe('count report', () => {
  it('per count: what was more, less and matched, from the posted moves; money at cost', () => {
    const docs = [cnt('CNT-1', '2026-11-05', { a: 12, b: 7, c: 4 }, { a: 10, b: 9, c: 4 }), cnt('CNT-2', '2026-11-06', { a: 3 }, { a: 5 }, 'reversed')];
    const moves = [mv('CNT-1', 'a', 2, 'EXT_ADJ', 'READY'), mv('CNT-1', 'b', 2, 'READY', 'EXT_ADJ'), mv('CNT-2', 'a', 2, 'READY', 'EXT_ADJ')];
    const r = countReport({ skus, archivedSkus: [], costs, moves, docs }, '2026-11-01', '2026-11-30');
    expect(r.counts).toHaveLength(1);   // the reversed count is left out
    const c = r.counts[0];
    expect([c.items, c.matched, c.more, c.less]).toEqual([3, 1, { items: 1, pieces: 2, value: 100 }, { items: 1, pieces: 2, value: 100 }]);
    expect(c.lines.map((l) => [l.sku, l.system, l.counted, l.diff])).toEqual([['b', 9, 7, -2], ['a', 10, 12, 2], ['c', 4, 4, 0]]);   // shortages first
    expect(r.byModel).toEqual({ SH2: { items: 2, more: 2, less: 2, value: 0 }, BR2: { items: 1, more: 0, less: 0, value: 0 } });
  });
  it('the posted change wins when the balance moved while counting', () => {
    // counted 12 against 10 at the start, but 1 piece was shipped meanwhile: the posted move is +3, and that is the change
    const r = countReport({ skus, archivedSkus: [], costs, moves: [mv('CNT-1', 'a', 3, 'EXT_ADJ', 'READY')], docs: [cnt('CNT-1', '2026-11-05', { a: 12 }, { a: 10 })] }, '2026-11-01', '2026-11-30');
    expect(r.counts[0].lines[0]).toEqual({ sku: 'a', system: 10, counted: 12, diff: 3 });
    expect(r.more).toEqual({ items: 1, pieces: 3, value: 150 });
  });
  it('outside the dates gives nothing', () => {
    const r = countReport({ skus, archivedSkus: [], costs, moves: [], docs: [cnt('CNT-1', '2026-10-05', { a: 1 }, { a: 1 })] }, '2026-11-01', '2026-11-30');
    expect([r.counts.length, r.items, r.more.pieces, r.less.pieces]).toEqual([0, 0, 0, 0]);
  });
});
