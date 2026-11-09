import { describe, expect, it } from 'vitest';
import { canStepForward, daysAr, describeRange, monthGrid, monthOf, presets, shiftRange } from './range';

const today = '2026-11-09';

describe('analytics period', () => {
  it('steps a window by its own length, never past today', () => {
    expect(shiftRange({ from: '2026-11-03', to: '2026-11-09' }, -1, today)).toEqual({ from: '2026-10-27', to: '2026-11-02' });
    expect(shiftRange({ from: '2026-10-27', to: '2026-11-02' }, 1, today)).toEqual({ from: '2026-11-03', to: '2026-11-09' });
    expect(shiftRange({ from: '2026-11-01', to: '2026-11-06' }, 1, today)).toEqual({ from: '2026-11-04', to: '2026-11-09' });
    expect(shiftRange({ from: '2026-11-05', to: '2026-11-05' }, -1, today)).toEqual({ from: '2026-11-04', to: '2026-11-04' });
    expect(canStepForward({ from: '2026-11-09', to: '2026-11-09' }, today)).toBe(false);
  });
  it('a calendar month steps by months', () => {
    expect(monthOf({ from: '2026-11-01', to: today }, today)).toBe(true);
    expect(monthOf({ from: '2026-11-01', to: '2026-11-05' }, today)).toBe(false);
    expect(shiftRange({ from: '2026-11-01', to: today }, -1, today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(shiftRange({ from: '2026-09-01', to: '2026-09-30' }, 1, today)).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(shiftRange({ from: '2026-10-01', to: '2026-10-31' }, 1, today)).toEqual({ from: '2026-11-01', to: today });
  });
  it('names the window', () => {
    expect(describeRange({ from: today, to: today }, today).title).toBe('النهارده');
    expect(describeRange({ from: '2026-11-03', to: today }, today)).toEqual({ title: 'آخر 7 أيام', days: '7 أيام' });
    expect(describeRange({ from: '2026-10-01', to: '2026-10-31' }, today).title).toBe('أكتوبر 2026');
    expect(describeRange({ from: '2026-10-31', to: '2026-11-05' }, today)).toEqual({ title: '31 أكتوبر – 5 نوفمبر', days: '6 أيام' });
    expect(describeRange({ from: '2026-11-02', to: '2026-11-05' }, today).title).toBe('2 – 5 نوفمبر');
    expect(describeRange({ from: '2026-11-05', to: '2026-11-05' }, today).title).toBe('الخميس، 5 نوفمبر');
    expect([1, 2, 3, 11].map(daysAr)).toEqual(['يوم', 'يومين', '3 أيام', '11 يوم']);
  });
  it('ready-made windows and the month grid', () => {
    expect(presets(today).find((p) => p.id === 'lastMonth')?.range).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    const g = monthGrid('2026-11-15');   // 1 Nov 2026 is a Sunday: one cell (Saturday) before it
    expect(g[0].slice(0, 2)).toEqual(['', '2026-11-01']);
    expect(g.flat().filter(Boolean)).toHaveLength(30);
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
});
