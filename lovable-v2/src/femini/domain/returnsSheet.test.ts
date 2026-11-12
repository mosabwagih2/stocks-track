import { describe, expect, it } from 'vitest';
import { returnCodesFromSheet } from './returnsSheet';
import type { Order } from './types';

const o = (ref: string, waybill: string) => ({ ref, waybill }) as unknown as Order;
const orders = [o('ab1234', '23772999'), o('cd5678', '23807114'), o('ef9012', '23807113')];

describe('returns sheet', () => {
  it('finds the orders by waybill or order number anywhere in the sheet, once each, in the sheet order', () => {
    const aoa = [
      ['تقرير المرتجعات', '', ''],
      ['البوليصة', 'رقم الأوردر', 'العميل'],
      ['CD5678', '23807114', 'منى'],          // the same order twice on one row: once
      ['', 23772999, 'سارة'],                  // a number cell (Excel keeps order numbers as numbers)
      [' #ef9012 ', '', ''],                   // spaces and # ignored, like the code box
      ['xx0000', '11111111', '250'],           // not an order: ignored
    ];
    expect(returnCodesFromSheet(aoa, orders).refs).toEqual(['cd5678', 'ab1234', 'ef9012']);
  });
  it('an empty or unrelated sheet gives nothing', () => {
    expect(returnCodesFromSheet([], orders).refs).toEqual([]);
    expect(returnCodesFromSheet([['a', 'b'], [1, 2]], orders).refs).toEqual([]);
  });
});
