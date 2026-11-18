import { describe, expect, it } from 'vitest';
import { labelMatches } from './productSearch';

describe('searching a product by what is typed', () => {
  it('model, colour and size in any order, any case', () => {
    expect(labelMatches('BR2 · احمر · XL', 'br2 احمر xl')).toBe(true);
    expect(labelMatches('BR2 · احمر · XL', 'XL BR2')).toBe(true);
    expect(labelMatches('BR2 · احمر · XL', 'br2 اسود')).toBe(false);
  });
  it('a single letter is a whole size: "l" is L, never the L inside XL or 2XL', () => {
    expect(labelMatches('BR2 · احمر · L', 'br2 احمر l')).toBe(true);
    expect(labelMatches('BR2 · احمر · XL', 'br2 احمر l')).toBe(false);
    expect(labelMatches('BR2 · احمر · 2XL', 'l')).toBe(false);
    expect(labelMatches('BR2 · احمر · 2XL', '2xl')).toBe(true);
  });
  it('two letters or more also match the start of a word', () => {
    expect(labelMatches('BR2 · احمر · M', 'br')).toBe(true);
    expect(labelMatches('BR2 · احمر · M', 'احم')).toBe(true);
    expect(labelMatches('SH1 · احمر · M', 'br')).toBe(false);
  });
  it('nothing typed matches nothing', () => { expect(labelMatches('BR2 · احمر · M', '  ')).toBe(false); });
});
