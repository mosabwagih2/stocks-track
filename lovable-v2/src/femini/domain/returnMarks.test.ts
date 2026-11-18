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

describe('exchanges and extra pieces', () => {
  it('a line that came back as another variant counts as that variant and is never missing', () => {
    const lines = returnLines([{ ref: 'a1', lines: ['S', 'S', 'M'] }], { a1: { S: { as: 'L', l: 2 }, M: { d: 1 } } });   // l is ignored: it came back, as L
    expect(lines).toEqual([{ sku: 'L', q: 0, exp: 2, r: 2, d: 0, x: 0 }, { sku: 'M', q: 0, exp: 1, r: 0, d: 1, x: 0 }]);
    const r = buildOp('RTN', { refs: ['a1'], counted: true }, lines, {} as never, '2026-11-12', '2026-11-12', (s) => s);
    expect(r.moves.filter((m) => m.to === 'LOST')).toEqual([]);                       // nothing posted as lost
    expect(r.warn.join(' ')).not.toMatch(/أكتر من المتوقع/);                          // and no "more than expected" warning
  });
  it('"as" the same variant is no exchange', () => {
    expect(returnLines([{ ref: 'a1', lines: ['S'] }], { a1: { S: { as: 'S', l: 1 } } })).toEqual([{ sku: 'S', q: 0, exp: 1, r: 0, d: 0, x: 0 }]);
  });
  it('extra pieces the customer sent are added to the variant, sound unless marked, added up with the order lines', () => {
    const lines = returnLines([{ ref: 'a1', lines: ['S'] }, { ref: 'b2', lines: ['S'] }], {}, { a1: [{ sku: 'S', n: 2, d: 1 }, { sku: 'XL', n: 1 }], b2: [{ sku: 'M', n: 0 }] });
    expect(lines.find((l) => l.sku === 'S')).toEqual({ sku: 'S', q: 0, exp: 4, r: 3, d: 1, x: 0 });
    expect(lines.find((l) => l.sku === 'XL')).toEqual({ sku: 'XL', q: 0, exp: 1, r: 1, d: 0, x: 0 });
    expect(lines.some((l) => l.sku === 'M')).toBe(false);                             // an empty extra is dropped
  });
  it('the pieces posted are exactly the pieces that came back, however they are mixed', () => {
    const lines = returnLines([{ ref: 'a1', lines: ['S', 'S'] }], { a1: { S: { as: 'L', x: 1 } } }, { a1: [{ sku: 'M', n: 2, d: 1 }] });
    const r = buildOp('RTN', { refs: ['a1'], counted: true }, lines, {} as never, '2026-11-12', '2026-11-12', (s) => s);
    expect(r.moves.reduce((a, m) => a + m.qty, 0)).toBe(4);   // 2 as L (1 scrap) + 2 extra M (1 for cleaning)
  });
});
