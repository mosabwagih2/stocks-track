import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { collectedOf, dayOf, parseSettlement, previewSettlement, type Settlement } from './settle';
import type { Order } from './types';

const H = ['', '', '', '', '', '', 'Company name', 'Serial', 'Order delivery status', 'Statusnote', 'Notes', 'Order date', 'Fullname', 'Code', 'Total amount', 'Phone', 'Address', 'Type', 'Total fees', 'Cod', 'Collect date', 'Return date', '', 'عدد القطع في الاوردر', 'إجمالي التوريد في الأوردر'];
const row = (left: unknown[], code: string, type: string, total: number, fees: number, cod: number, cdate: string, rdate: string, pcs: unknown, sup: unknown, note = '') =>
  [...left, ...Array(6 - left.length).fill(''), 'V', '9' + code, type === 'return' ? 5 : 3, note, '', '', 'x', code, total, 0, '', type === 'partial' ? 'return' : type, fees, cod, cdate, rdate, '', pcs, sup];
const sheet = [
  ['تسوية Femini-G- 4-11-2026', '', '', '', 'Femini-G-'],
  H,
  row(['المبلغ الإجمالي'], 'aa1', 'collect', 500, 65, 435, '04/11/2026', '\u00a0', 2, 120),
  row([1000, '', '', 'إجمالي المبيعات'], 'bb2', 'collect', 500, 65, 435, '03/11/2026', '\u00a0', 3, 150),
  row([870, '', '', 'المبلغ المستحق Femini-G-'], 'cc3', 'return', 0, 0, 0, '\u00a0', '04/11/2026', '-', '-'),
  row([], 'dd4', 'partial', 0, 0, 0, '\u00a0', '04/11/2026', '-', '-', 'استبدال'),
  row([600, '', '', 'المبلغ المستحق لفيندور'], 'bb2', 'collect', 0, 0, 0, '04/11/2026', '\u00a0', -1, -30, 'فرق تحصيل'),
];
const order = (ref: string, status: Order['status']): Order => ({ ref, waybill: '9' + ref, type: 'new', gov: '', total: 0, lines: ['X'], unmapped: [], pickupId: 'P1', status });

describe('settlement sheet', () => {
  it('reads rows, types, dates, amounts and the totals block', () => {
    const p = parseSettlement(sheet);
    expect(p.date).toBe('2026-11-04');
    expect(p.rows.map((r) => [r.ref, r.type, r.cod, r.supply, r.pieces, r.date])).toEqual([
      ['aa1', 'collect', 435, 120, 2, '2026-11-04'], ['bb2', 'collect', 435, 150, 3, '2026-11-03'], ['cc3', 'return', 0, 0, null, '2026-11-04'], ['dd4', 'partial', 0, 0, null, '2026-11-04'], ['bb2', 'adjust', 0, -30, -1, '2026-11-04']]);
    expect(p.totals).toEqual({ sales: 1000, cod: 870, shipping: 130, due: 870, vendoor: 600 });
    expect(dayOf('4-11-2026')).toBe('2026-11-04');
  });
  it('collected vs returned per order; a sheet uploaded twice is recognised', () => {
    const p = parseSettlement(sheet); const s: Settlement = { ...p, id: 'STL-0001', source: 'x.xlsx', at: '', by: 'M' };
    const { collected, returned } = collectedOf([s]);
    expect([...collected.keys()]).toEqual(['aa1', 'bb2']); expect(collected.get('bb2')!.due).toBe(150);
    expect([...returned.keys()]).toEqual(['cc3', 'dd4']);
    const pv = previewSettlement(p, [order('aa1', 'shipped'), order('bb2', 'open')], new Set(['cc3']), [s]);
    expect(pv).toMatchObject({ rows: 5, collect: 2, ret: 1, partial: 1, adjust: 1, inSystem: 3, old: 1, dup: 5, allDup: true });
    expect(pv.notShipped.map((r) => r.ref)).toEqual(['bb2']);
  });
  it('the date always comes from the name: the title cell, else the file name; none → refused', () => {
    const noTitle = [['', ''], ...sheet.slice(1)];
    expect(parseSettlement(noTitle, 'Femini-G- qp 05-11-2026 تسوية Total ( 38,870 ).xlsx').date).toBe('2026-11-05');
    expect(() => parseSettlement(noTitle, 'x.xlsx')).toThrow(/تاريخ التسوية/);
  });
  it('refuses a file that is not a settlement', () => {
    expect(() => parseSettlement([['a', 'b'], [1, 2]])).toThrow(/تسوية/);
  });
});

const dir = process.env.FEMINI_SETTLE_DIR;
const sheets = dir && fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /تسوية.*\.xlsx$/.test(f) && !f.startsWith('~$')) : [];
// what each real sheet says about itself (its totals block and its file name)
const EXPECT: Record<string, { date: string; rows: number; collect: number; ret: number; partial: number; adjust: number; sales: number; cod: number; due: number; vendoor: number }> = {
  // named 31-11 (no such day); the sheet itself says "توريد يوم 31 أكتوبر"
  '31-11-2026': { date: '2026-10-31', rows: 55, collect: 39, ret: 14, partial: 2, adjust: 0, sales: 53014, cod: 50274, due: 34170, vendoor: 16104 },
  '01-11-2026': { date: '2026-11-01', rows: 68, collect: 51, ret: 14, partial: 3, adjust: 0, sales: 63913, cod: 60253, due: 41150, vendoor: 19103 },
  '02-11-2026': { date: '2026-11-02', rows: 74, collect: 58, ret: 10, partial: 5, adjust: 1, sales: 86270, cod: 81400, due: 48590, vendoor: 32810 },
  '03-11-2026': { date: '2026-11-03', rows: 90, collect: 76, ret: 12, partial: 2, adjust: 0, sales: 90819, cod: 85489, due: 49510, vendoor: 35979 },
  '04-11-2026': { date: '2026-11-04', rows: 92, collect: 71, ret: 14, partial: 6, adjust: 1, sales: 79168, cod: 72993, due: 42765, vendoor: 30228 },
  '05-11-2026': { date: '2026-11-05', rows: 90, collect: 65, ret: 22, partial: 2, adjust: 1, sales: 70903, cod: 65468, due: 38870, vendoor: 26598 },
};
describe.skipIf(!sheets.length)('the real settlement sheets', () => {
  for (const f of sheets) it(f, () => {
    const wb = XLSX.read(fs.readFileSync(`${dir}/${f}`), { type: 'buffer' });
    const p = parseSettlement(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }), f);
    const e = EXPECT[Object.keys(EXPECT).find((k) => f.includes(k))!];
    const n = (t: string) => p.rows.filter((r) => r.type === t).length;
    expect({ date: p.date, rows: p.rows.length, collect: n('collect'), ret: n('return'), partial: n('partial'), adjust: n('adjust'), sales: p.totals.sales, cod: p.totals.cod, due: p.totals.due, vendoor: p.totals.vendoor }).toEqual(e);
    expect(p.totals.shipping).toBe(e.sales - e.cod);                 // the shipping company's due = sales − net
    expect(p.totals.due + p.totals.vendoor).toBe(p.totals.cod);       // net = Fémini + Vendoor
    expect(p.rows.reduce((a, r) => a + r.supply, 0)).toBe(e.due);     // Fémini's due = its share of every order
    expect(!!p.dateNote).toBe(f.includes('31-11'));                 // the wrong name is pointed out
    expect(f).toMatch(new RegExp(`\( ${e.due.toLocaleString('en-US')} \)`));   // the number in the file name
  });
});
