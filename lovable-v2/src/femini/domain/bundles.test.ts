import { describe, expect, it } from 'vitest';
import { BUNDLES } from '@/femini/data/bundles.generated';
import { bundleBySize, bundleTotal, compCapacity, normColor, type Bundle, type Stockroom } from './bundles';
// @ts-expect-error the generator is a plain script
import { compsOf, parenComps } from '../../../scripts/bundles.mjs';

/** a stock room from a table: model → color → size → pieces */
const room = (t: Record<string, Record<string, Record<string, number>>>): Stockroom => ({
  colorsOf: (m) => Object.keys(t[m] ?? {}),
  have: (m, c, z) => t[m]?.[c]?.[z] ?? null,
});

describe('bundle capacity: the scarcest piece decides', () => {
  const r = room({ SH2: { احمر: { M: 5 }, اسود: { M: 2 }, ابيض: { M: 40 }, رمادي: { M: 9 } } });
  it('named colors: one of each, the scarcest color limits', () => {
    expect(compCapacity({ model: 'SH2', qty: 3, colors: ['أحمر', 'أسود', 'رمادي'] }, 'M', r).max).toBe(2);
  });
  it('any color: just the pieces of the model', () => {
    expect(compCapacity({ model: 'SH2', qty: 3, any: true }, 'M', r).max).toBe(18);   // 56 pieces / 3
  });
  it('all colors but one: the left-out color is not counted', () => {
    const c = compCapacity({ model: 'SH2', qty: 3, colors: null, except: ['الابيض'] }, 'M', r);
    expect(c.colors).toEqual(['احمر', 'اسود', 'رمادي']); expect(c.max).toBe(2);
  });
  it('two pieces from two colors take one of each', () => {
    expect(compCapacity({ model: 'SH2', qty: 2, colors: ['اسود', 'ابيض'] }, 'M', r).max).toBe(2);
  });
  it('an item the catalog does not have is reported and gives none', () => {
    const c = compCapacity({ model: 'SH2', qty: 2, colors: ['اسود', 'اخضر'] }, 'M', r);
    expect(c.missing).toEqual(['اخضر']); expect(c.max).toBe(0);
  });
  it('a negative balance counts as none', () => {
    expect(compCapacity({ model: 'SH2', qty: 1, colors: ['اسود'] }, 'M', room({ SH2: { اسود: { M: -3 } } })).max).toBe(0);
  });
  it('colors are the same however the hamza is written', () => {
    expect(normColor('أحمر')).toBe(normColor('احمر')); expect(normColor('الابيض')).toBe('ابيض'); expect(normColor('أورنج')).toBe('برتقالي');
  });
});

describe('a bundle by size', () => {
  const b: Bundle = { id: '1', title: 't', type: 'Packs', price: 1, was: 2, url: '', available: true, sizes: ['S', 'M'], variants: [{ label: '', comps: [{ model: 'BR2', qty: 2, colors: ['اسود', 'ابيض'] }, { model: 'PAN3', qty: 1, any: true }] }] };
  const r = room({ BR2: { اسود: { S: 4, M: 0 }, ابيض: { S: 9, M: 9 } }, PAN3: { اسود: { S: 3, M: 3 } } });
  it('every size on its own, the weakest component per size', () => {
    const by = bundleBySize(b, r);
    expect(by.map((x) => [x.size, x.max])).toEqual([['S', 3], ['M', 0]]);
    expect(bundleTotal(by)).toBe(3); expect(by[0].best?.limiting?.comp.model).toBe('PAN3');
  });
  it('several color combinations: the best one counts', () => {
    const two: Bundle = { ...b, variants: [{ label: 'a', comps: [{ model: 'BR2', qty: 1, colors: ['اسود'] }] }, { label: 'b', comps: [{ model: 'BR2', qty: 1, colors: ['ابيض'] }] }] };
    expect(bundleBySize(two, r)[0].max).toBe(9);
  });
});

describe('reading the store\'s codes', () => {
  it('a code with the pieces of each model', () => {
    expect(parenComps('(٥ قطع  FC-BR2 كل الالوان) + (٥ قطع FC-SH2 كل الالوان ما عدا الابيض) + (قطعة  FC-BR1 احمر)')).toEqual([
      { model: 'BR2', qty: 5, colors: null, except: [] }, { model: 'SH2', qty: 5, colors: null, except: ['الابيض'] }, { model: 'BR1', qty: 1, colors: ['احمر'] }]);
  });
  it('a plain model code: the count from the name, the colors from the option', () => {
    expect(compsOf('FC-PAN4', 'باندل ٣ قطع بانتي', 'أحمر - أسود - رمادي', 1)).toEqual([{ model: 'PAN4', qty: 3, colors: ['أحمر', 'أسود', 'رمادي'] }]);
  });
  it('a model with its color each', () => {
    expect(compsOf('D2 احمر/ D1 اسود/ D3 فوشيا', 'باك ٣ طقم', '', 1)).toEqual([{ model: 'D2', qty: 1, colors: ['احمر'] }, { model: 'D1', qty: 1, colors: ['اسود'] }, { model: 'D3', qty: 1, colors: ['فوشيا'] }]);
  });
});

describe('the bundles read from the store', () => {
  it('has bundles, each counted or marked as not known', () => {
    expect(BUNDLES.length).toBeGreaterThan(20);
    for (const b of BUNDLES) {
      if (b.unknown) continue;
      expect(b.variants.length, b.title).toBeGreaterThan(0); expect(b.sizes.length, b.title).toBeGreaterThan(0);
      for (const v of b.variants) for (const c of v.comps) { expect(c.qty, b.title).toBeGreaterThan(0); expect(c.model, b.title).toMatch(/^[A-Z]+\d+$/); }
    }
  });
});
