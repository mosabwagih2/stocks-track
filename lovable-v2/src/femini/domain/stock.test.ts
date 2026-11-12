import { describe, expect, it } from 'vitest';
import { coverLabel } from './stock';

describe('cover label (يكفي كام يوم)', () => {
  it('is ready ÷ withdrawal rate, whole days rounded down', () => {
    expect(coverLabel({ ready: 90, velocity: 6.4 })).toBe('14 يوم');
    expect(coverLabel({ ready: 7, velocity: 1 })).toBe('7 أيام');
    expect(coverLabel({ ready: 5, velocity: 2 })).toBe('يومين');
    expect(coverLabel({ ready: 3, velocity: 2 })).toBe('يوم');
    expect(coverLabel({ ready: 1, velocity: 2 })).toBe('أقل من يوم');
  });
  it('edges: no withdrawals, out of stock, a long cover, an estimated rate', () => {
    expect(coverLabel({ ready: 50, velocity: 0 })).toBe('');
    expect(coverLabel({ ready: 0, velocity: 3 })).toBe('خلص');
    expect(coverLabel({ ready: -13, velocity: 3 })).toBe('خلص');
    expect(coverLabel({ ready: 700, velocity: 1 })).toBe('+60 يوم');
    expect(coverLabel({ ready: 7, velocity: 1 }, true)).toBe('~7 أيام');
  });
});
