import { describe, expect, it } from 'vitest';
import { comparePeriods, lastDays, rangeDays } from './insights-tools';
import type { Derived } from '@/femini/hooks/data';

const d = { today: '2026-11-08', snap: { orders: [] }, pickupDate: new Map() } as unknown as Derived;

describe('analytics date range', () => {
  it('a chosen range is compared with the same number of days right before it', () => {
    const c = comparePeriods(d, { from: '2026-11-01', to: '2026-11-05' });
    expect([c.cur.from, c.cur.to, c.prev.from, c.prev.to]).toEqual(['2026-11-01', '2026-11-05', '2026-10-27', '2026-10-31']);
    expect(c.curDays).toHaveLength(5); expect(c.prevDays).toHaveLength(5);
  });
  it('the ready-made periods are the last N days up to today', () => {
    expect(lastDays('2026-11-08', 7)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(rangeDays({ from: '2026-10-31', to: '2026-11-01' })).toBe(2);
    const c = comparePeriods(d, 14);
    expect([c.cur.from, c.cur.to, c.prev.to]).toEqual(['2026-10-26', '2026-11-08', '2026-10-25']);
  });
});
