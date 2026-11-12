import { describe, expect, it } from 'vitest';
import { buildOp, returnLines } from './ops';

const orders = [{ ref: 'a1', lines: ['S', 'S', 'M'] }, { ref: 'b2', lines: ['S'] }];

describe('return marks', () => {
  it('nothing marked: every piece came back sound', () => {
    expect(returnLines(orders)).toEqual([{ sku: 'S', q: 0, exp: 3, r: 3, d: 0, x: 0 }, { sku: 'M', q: 0, exp: 1, r: 1, d: 0, x: 0 }]);
  });
  it('marked pieces leave sound with the rest, and the missing ones post as lost: the parts add up to the pieces', () => {
    const lines = returnLines(orders, { a1: { S: { d: 1, l: 1 } }, b2: { S: { x: 1 } } });
    expect(lines.find((l) => l.sku === 'S')).toEqual({ sku: 'S', q: 0, exp: 3, r: 0, d: 1, x: 1 });
    const r = buildOp('RTN', { refs: ['a1', 'b2'], counted: true }, lines, {} as never, '2026-11-12', '2026-11-12', (s) => s);
    const sum = (to: string) => r.moves.filter((m) => m.to === to).reduce((a, m) => a + m.qty, 0);
    expect([sum('READY'), sum('DIRTY'), sum('SCRAP'), sum('LOST')]).toEqual([1, 1, 1, 1]);   // M sound, S: cleaning, scrap, missing
    expect(r.moves.reduce((a, m) => a + m.qty, 0)).toBe(4);   // exactly the 4 pieces shipped
  });
  it('more marked than the order has is cut to its pieces, never a negative sound count', () => {
    const [s] = returnLines([{ ref: 'a1', lines: ['S', 'S'] }], { a1: { S: { d: 2, x: 5, l: 3 } } });
    expect(s).toEqual({ sku: 'S', q: 0, exp: 2, r: 0, d: 2, x: 0 });
  });
});
