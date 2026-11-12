import { describe, expect, it } from 'vitest';
import type { Bundle, Stockroom } from './bundles';
import { balanced, maxOf, plan, productsOf, sharing, supplyOf, take } from './bundlePlan';

const table: Record<string, Record<string, Record<string, number>>> = {
  BR1: { احمر: { S: 100 }, اسود: { S: 100 }, رمادي: { S: 100 }, ابيض: { S: 10 }, بيج: { S: 10 } },
  PAN4: { احمر: { S: 50 }, اسود: { S: 50 } },
};
const room: Stockroom = { colorsOf: (m) => Object.keys(table[m] ?? {}), have: (m, c, z) => table[m]?.[c]?.[z] ?? null };
const b3: Bundle = { id: 'a', title: '3× BR1', type: '', price: 0, was: 0, url: '', available: true, sizes: ['S'], variants: [{ label: '', comps: [{ model: 'BR1', qty: 3, colors: ['احمر', 'اسود', 'رمادي'] }] }] };
const b5: Bundle = { id: 'b', title: '5× BR1', type: '', price: 0, was: 0, url: '', available: true, sizes: ['S'], variants: [{ label: '', comps: [{ model: 'BR1', qty: 5, colors: ['احمر', 'اسود', 'رمادي', 'ابيض', 'بيج'] }] }] };
const b2: Bundle = { id: 'c', title: 'PAN4', type: '', price: 0, was: 0, url: '', available: true, sizes: ['S'], variants: [{ label: '', comps: [{ model: 'PAN4', qty: 2, colors: ['احمر', 'اسود'] }] }] };
const ps = productsOf([b3, b5, b2]); const supply = supplyOf(room, 'S', ['BR1', 'PAN4']);

describe('bundles share the same pieces', () => {
  it('each on its own would fill more than both together can', () => {
    expect(maxOf(ps[0], 'S', supply, room)).toBe(100); expect(maxOf(ps[1], 'S', supply, room)).toBe(10);
    const p = plan(ps, [{ key: 'a#0', n: 100 }, { key: 'b#0', n: 10 }], 'S', room, supply);
    expect(p.rows.map((r) => r.ok)).toEqual([true, false]);   // 100 + 10 of the red, black and grey is 110 of 100
    expect(p.total).toBe(100);
  });
  it('what is left after one is what the other can still fill', () => {
    const p = plan(ps, [{ key: 'a#0', n: 95 }, { key: 'b#0', n: 5 }], 'S', room, supply);
    expect(p.rows.map((r) => r.ok)).toEqual([true, true]);
    expect(p.rows[1].max).toBe(5);   // the red, black and grey have 5 left each
    expect(p.rows[0].max).toBe(95);
  });
  it('the same number of orders of each: the most that fits together', () => {
    expect(balanced(ps, ['a#0', 'b#0'], 'S', room, supply)).toBe(10);
    expect(balanced(ps, ['a#0', 'c#0'], 'S', room, supply)).toBe(50);   // not sharing: each is limited on its own (PAN4: 50 of each color)
  });
  it('a bundle of other models does not touch it', () => {
    const s = take(supply, ps[2], 'S', 20, room)!; expect(maxOf(ps[0], 'S', s, room)).toBe(100);
  });
  it('lists the bundles that draw on the same pieces', () => {
    const sh = sharing([b3, b5, b2], room, 'S');
    expect(sh.get('a')!.map((b) => b.id)).toEqual(['b']); expect(sh.get('c')).toEqual([]);
  });
});
