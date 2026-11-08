import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { collectedOf, dayOf, parseSettlement, previewSettlement, type Settlement } from './settle';
import type { Order } from './types';

const H = ['', '', '', '', '', '', 'Company name', 'Serial', 'Order delivery status', 'Statusnote', 'Notes', 'Order date', 'Fullname', 'Code', 'Total amount', 'Phone', 'Address', 'Type', 'Total fees', 'Cod', 'Collect date', 'Return date', '', 'عدد القطع في الاوردر', 'إجمالي التوريد في الأوردر'];
const row = (left: unknown[], code: string, type: string, total: number, fees: number, cod: number, cdate: string, rdate: string, pcs: unknown, sup: unknown, note = '') =>
  [...left, ...Array(6 - left.length).fill(''), 'V', '9' + code, type === 'collect' ? 3 : 5, note, '', '', 'x', code, total, 0, '', type, fees, cod, cdate, rdate, '', pcs, sup];
const sheet = [
  ['تسوية Femini-G- 4-11-2026', '', '', '', 'Femini-G-'],
  H,
  row(['المبلغ الإجمالي'], 'aa1', 'collect', 500, 65, 435, '04/11/2026', ' ', 2, 120),
  row([1000, '', '', 'إجمالي المبيعات'], 'bb2', 'collect', 500, 65, 435, '03/11/2026', ' ', 3, 150),
  row([870, '', '', 'المبلغ المستحق Femini-G-'], 'cc3', 'return', 0, 0, 0, ' ', '04/11/2026', '-', '-'),
  row([600, '', '', 'المبلغ المستحق لفيندور'], 'bb2', 'collect', 0, 0, 0, '04/11/2026', ' ', -1, -30, 'فرق تحصيل'),
];
const order = (ref: string, status: Order['status']): Order => ({ ref, waybill: '9' + ref, type: 'new', gov: '', total: 0, lines: ['X'], unmapped: [], pickupId: 'P1', status });

describe('settlement sheet', () => {
  it('reads rows, types, dates, amounts and the totals block', () => {
    const p = parseSettlement(sheet);
    expect(p.date).toBe('2026-11-04');
    expect(p.rows.map((r) => [r.ref, r.type, r.cod, r.supply, r.pieces, r.date])).toEqual([
      ['aa1', 'collect', 435, 120, 2, '2026-11-04'], ['bb2', 'collect', 435, 150, 3, '2026-11-03'], ['cc3', 'return', 0, 0, null, '2026-11-04'], ['bb2', 'adjust', 0, -30, -1, '2026-11-04']]);
    expect(p.totals).toEqual({ sales: 1000, cod: 870, due: 870, channel: 600 });
    expect(dayOf('4-11-2026')).toBe('2026-11-04');
  });
  it('collected vs returned per order; a sheet uploaded twice is recognised', () => {
    const p = parseSettlement(sheet); const s: Settlement = { ...p, id: 'STL-0001', source: 'x.xlsx', at: '', by: 'M' };
    const { collected, returned } = collectedOf([s]);
    expect([...collected.keys()]).toEqual(['aa1', 'bb2']); expect(collected.get('bb2')!.due).toBe(150);
    expect([...returned.keys()]).toEqual(['cc3']);
    const pv = previewSettlement(p, [order('aa1', 'shipped'), order('bb2', 'open')], new Set(['cc3']), [s]);
    expect(pv).toMatchObject({ rows: 4, collect: 2, ret: 1, inSystem: 3, old: 1, dup: 4, allDup: true });
    expect(pv.notShipped.map((r) => r.ref)).toEqual(['bb2']);
  });
  it('refuses a file that is not a settlement', () => {
    expect(() => parseSettlement([['a', 'b'], [1, 2]])).toThrow(/تسوية/);
  });
});

const file = process.env.FEMINI_SETTLE_FILE;
describe.skipIf(!file || !fs.existsSync(file))('the real settlement sheet', () => {
  it('matches the totals written in it', () => {
    const wb = XLSX.read(fs.readFileSync(file!), { type: 'buffer' });
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' });
    const p = parseSettlement(aoa);
    expect(p.date).toBe('2026-11-04');
    expect(p.rows).toHaveLength(92);
    expect(p.rows.filter((r) => r.type === 'collect')).toHaveLength(71);
    expect(p.rows.filter((r) => r.type === 'adjust')).toHaveLength(1);
    expect(p.totals).toEqual({ sales: 79168, cod: 72993, due: 42765, channel: 30228 });
    expect(p.rows.reduce((a, r) => a + r.supply, 0)).toBe(42765);
  });
});
