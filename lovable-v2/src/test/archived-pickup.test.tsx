import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ArchivedPickup } from '@/femini/components/ArchivedPickup';
import type { Derived } from '@/femini/hooks/data';

const sku = (model: string) => ({ id: `${model}-R-L`, model, color: 'احمر', size: 'L' });
const d = { skuMap: new Map([['BR2-R-L', sku('BR2')], ['SH1-R-L', sku('SH1')]]) } as unknown as Derived;
const order = (ref: string, status: 'open' | 'shipped' | 'cancelled', lines: string[]) => ({ ref, waybill: `9${ref}`, gov: 'القاهرة', status, lines });
const x = {
  pickup: { id: 'P7', label: 'بيك أب 7', date: '2026-10-29', channel: 'VENDOOR', source: 'بيك اب FEMINI G 29-10-2026.xlsx' },
  by: 'Mosab', at: '2026-11-15T14:40:31.631Z',
  orders: [order('aa1111', 'open', ['BR2-R-L', 'BR2-R-L']), order('bb2222', 'open', ['SH1-R-L']), order('cc3333', 'cancelled', ['BR2-R-L'])],
} as unknown as Parameters<typeof ArchivedPickup>[0]['x'];
const who = (by?: string, at?: string) => `أرشفه ${by} · ${at?.slice(0, 10)}`;

describe('an archived pickup tells you what it is', () => {
  it('shows the file, the day, the channel, the counts by state, what came back, who archived it, and the duplicates', () => {
    const { container } = render(<ArchivedPickup x={x} d={d} who={who} dup={[['بيك أب 31 (مؤرشف)', 3]]} returned={2} onRestore={vi.fn()} />);
    const t = container.textContent ?? '';
    expect(t).toContain('بيك أب 7'); expect(t).toContain('بيك اب FEMINI G 29-10-2026.xlsx'); expect(t).toContain('29-10-2026');
    expect(t).toMatch(/3\s*أوردر/); expect(t).toMatch(/4\s*قطعة/);                       // 3 orders, 4 pieces
    expect(t).toContain('مفتوح 2'); expect(t).toContain('ملغي 1'); expect(t).not.toContain('مشحون');
    expect(t).toContain('رجع منه 2 بمرتجع');
    expect(t).toContain('أرشفه Mosab · 2026-11-15');
    expect(t).toContain('أوردرات مكررة مع: بيك أب 31 (مؤرشف) (3)');
    expect(t).toContain('BR2 · 3'); expect(t).toContain('SH1 · 1');                       // pieces per model
    expect(screen.getByRole('button', { name: 'استرجاع' })).toBeTruthy();
  });
  it('a pure copy is marked, an original is not', () => {
    const copy = render(<ArchivedPickup x={x} d={d} who={who} dup={[]} returned={0} isCopy onRestore={vi.fn()} />).container.textContent ?? '';
    expect(copy).toContain('نسخة مكررة');
  });
  it('a pickup with no file name, no duplicates and no returns says so quietly', () => {
    const y = { ...x, pickup: { ...x.pickup, source: '' } } as typeof x;
    const { container } = render(<ArchivedPickup x={y} d={d} who={who} dup={[]} returned={0} onRestore={vi.fn()} />);
    const t = container.textContent ?? '';
    expect(t).toContain('اسم الملف مش متسجّل'); expect(t).not.toContain('مكررة'); expect(t).not.toContain('رجع منه');
  });
});
