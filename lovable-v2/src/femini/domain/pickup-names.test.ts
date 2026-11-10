import { describe, expect, it } from 'vitest';
import { parsePickupRows, pickupNames } from './pickup';

const head = ['كود الاوردر العشوائي', 'بوليصة الشحن', 'حالة الاوردر الجزئية', 'المحافظة', 'المبلغ توتال بالشحن للاوردر', 'المنتجات المطلوبة في الاوردر'];
const rows = [head,
  ['a1', '9001', '', 'القاهرة', 900, 'FC-PAN6-Bundle ( بانتي باندل )-L-باندل خمس قطع-2, FC-BR2 ( برا )-M-احمر-1'],
  ['a2', '9002', '', 'الجيزة', 700, 'FC-PAN6-Bundle ( اسم تاني )-XL-باندل خمس قطع-1, ده سطر مش مفهوم'],
];

describe('the product name in a pickup', () => {
  it('is read per model code as written, the first one seen, and unreadable lines are skipped', () => {
    expect(pickupNames(rows)).toEqual({ 'FC-PAN6-Bundle': 'بانتي باندل', 'FC-BR2': 'برا' });
  });
  it('does not change how the pickup is matched: the unlinked lines keep their shape', () => {
    const r = parsePickupRows(rows, [], new Set());
    expect(r.orders[0].unmapped).toEqual([['FC-PAN6-Bundle', 'L', 'باندل خمس قطع', 2], ['FC-BR2', 'M', 'احمر', 1]]);
  });
  it('a sheet in the wrong format gives no names instead of failing', () => {
    expect(pickupNames([['x', 'y'], ['1', '2']])).toEqual({});
    expect(pickupNames([])).toEqual({});
  });
});
