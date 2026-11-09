import { describe, expect, it } from 'vitest';
import { buildOp } from './ops';
import { itemMapper } from './pickup';
import { orderModels } from '@/femini/hooks/data';
import type { Sku } from './types';

describe('shop return (مرتجع المحل)', () => {
  it('moves each line from the shop into the state it came back in', () => {
    const r = buildOp('SRT', { shop: 'المحل 1', note: 'مقاس غلط' }, [{ sku: 'A', q: 2, to: 'READY' }, { sku: 'A', q: 1, to: 'DIRTY' }, { sku: 'B', q: 1, to: 'SCRAP' }], {}, '2026-11-09', '2026-11-09');
    expect(r.ok).toBe(true);
    expect(r.moves.map((m) => [m.sku, m.qty, m.from, m.to])).toEqual([['A', 2, 'EXT_SHOP', 'READY'], ['A', 1, 'EXT_SHOP', 'DIRTY'], ['B', 1, 'EXT_SHOP', 'SCRAP']]);
    expect(r.moves[0].note).toContain('المحل 1');
  });
  it('needs the shop name and at least one piece; an unknown state goes to ready', () => {
    expect(buildOp('SRT', {}, [{ sku: 'A', q: 1 }], {}, '2026-11-09', '2026-11-09').ok).toBe(false);
    expect(buildOp('SRT', { shop: 'x' }, [], {}, '2026-11-09', '2026-11-09').ok).toBe(false);
    expect(buildOp('SRT', { shop: 'x' }, [{ sku: 'A', q: 1, to: 'LOST' }], {}, '2026-11-09', '2026-11-09').moves[0].to).toBe('READY');
  });
});

describe('model order for the pickers', () => {
  it('groups by line, the most pulled line first; inside a line by pull, then stock, then number', () => {
    const codes = ['A1', 'BR2', 'BR10', 'PAN6', 'PAN1', 'SH3', 'A2'];
    const pull = { BR10: 5, BR2: 9, PAN6: 30, SH3: 1 };
    const stock = { A2: 4, PAN1: 7 };
    expect(orderModels(codes, pull, stock)).toEqual(['PAN6', 'PAN1', 'BR2', 'BR10', 'SH3', 'A2', 'A1']);
  });
});

describe('pickup codes with a hyphen', () => {
  it('"PA-3" finds the catalog model PA3; nothing else is guessed', () => {
    const skus: Sku[] = [{ id: 'k1', model: 'PA3', color: 'احمر', size: 'L' } as Sku];
    const map = itemMapper(skus);
    expect(map('PA-3', 'L', 'احمر').id).toBe('k1');
    expect(map('FC-PA-3', 'L', 'احمر').id).toBe('k1');
    expect(map('PA-4', 'L', 'احمر').model).toBeNull();
  });
});
