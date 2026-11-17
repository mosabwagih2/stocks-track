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
    const r = returnCodesFromSheet(aoa, orders);
    expect(r.refs).toEqual(['cd5678', 'ab1234', 'ef9012']);
    expect(r.returnRows).toBe(0); expect(r.missing).toEqual([]); // no Type column: nothing is filtered
  });
  it('an empty or unrelated sheet gives nothing', () => {
    expect(returnCodesFromSheet([], orders).refs).toEqual([]);
    expect(returnCodesFromSheet([['a', 'b'], [1, 2]], orders).refs).toEqual([]);
  });
});

// the courier's report: «collect» rows are delivered orders (the money came), only «return» rows are returns
const head = ['Company name', 'Serial', 'Order delivery status', 'Statusnote', 'Order date', 'Full name', 'Phone', 'Type', 'Collect date', 'Return date'];
const row = (serial: number, type: string) => ['Femini G Vendoor', serial, 'Delivered', '', '2026-10-28', 'Name - zz0000', '0100', type, '2026-10-30', null];
describe('returns sheet with a Type column', () => {
  it('reads only the return rows: a collect row is not a return even when its order exists', () => {
    const aoa = [head, row(23772999, 'collect'), row(23807114, 'return'), row(23807113, 'collect')];
    const r = returnCodesFromSheet(aoa, orders);
    expect(r.refs).toEqual(['cd5678']);
    expect(r.returnRows).toBe(1); expect(r.skippedRows).toBe(2); expect(r.missing).toEqual([]);
  });
  it('return rows that match no order come back as missing, with their serial', () => {
    const aoa = [head, row(23481433, 'return'), row(23807114, 'return'), row(23536901, 'return'), row(23683255, 'collect')];
    const r = returnCodesFromSheet(aoa, orders);
    expect(r.refs).toEqual(['cd5678']);
    expect(r.missing).toEqual(['23481433', '23536901']);
    expect(r.returnRows).toBe(3); expect(r.skippedRows).toBe(1);
  });
  it('a sheet of returns that are all unknown: nothing found, every serial reported', () => {
    const r = returnCodesFromSheet([head, row(1, 'return'), row(2, 'Return ')], orders);
    expect(r.refs).toEqual([]); expect(r.missing).toEqual(['1', '2']); expect(r.returnRows).toBe(2);
  });
  it('a header in each sheet of the workbook resets the filter; rows before any header are read as before', () => {
    const aoa = [[23772999, 'x'], head, row(23807114, 'collect'), head, row(23807113, 'return')];
    expect(returnCodesFromSheet(aoa, orders).refs).toEqual(['ab1234', 'ef9012']);
  });
  it('Arabic headers and values work too', () => {
    const aoa = [['البوليصة', 'النوع'], [23807114, 'تحصيل'], [23807113, 'مرتجع']];
    expect(returnCodesFromSheet(aoa, orders).refs).toEqual(['ef9012']);
  });
});
