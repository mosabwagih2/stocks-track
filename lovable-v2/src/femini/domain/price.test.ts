import { describe, expect, it } from 'vitest';
import { priceConflicts, supplyPrice } from './price';

describe('سعر التوريد', () => {
  it('reads cost, else price, else 0', () => {
    expect(supplyPrice({ cost: 140, price: 140 })).toBe(140);
    expect(supplyPrice({ cost: 0, price: 90 })).toBe(90);
    expect(supplyPrice({ cost: 75, price: 0 })).toBe(75);
    expect(supplyPrice({ cost: -5, price: Number.NaN })).toBe(0);
    expect(supplyPrice(undefined)).toBe(0);
  });
  it('lists only models with two different numbers', () => {
    expect(priceConflicts({ D3: { cost: 140, price: 140 }, A: { cost: 100, price: 120 }, B: { cost: 0, price: 50 } })).toEqual([{ model: 'A', cost: 100, price: 120 }]);
  });
});
