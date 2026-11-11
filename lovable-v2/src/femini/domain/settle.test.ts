import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { collectedOf, dayOf, parseSettlement, previewSettlement, supplyOnly, type Settlement } from './settle';
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
  it("reads rows, types, dates and Fémini's share only (no sales, shipping fees, net or Vendoor share)", () => {
    const p = parseSettlement(sheet);
    expect(p.date).toBe('2026-11-04');
    expect(p.rows.map((r) => [r.ref, r.type, r.supply, r.pieces, r.date])).toEqual([
      ['aa1', 'collect', 120, 2, '2026-11-04'], ['bb2', 'collect', 150, 3, '2026-11-03'], ['cc3', 'return', 0, null, '2026-11-04'], ['dd4', 'partial', 0, null, '2026-11-04'], ['bb2', 'adjust', -30, -1, '2026-11-04']]);
    expect(p.totals).toEqual({ due: 870 });
    for (const row of p.rows) expect(Object.keys(row).sort()).toEqual(['date', 'note', 'pieces', 'ref', 'serial', 'status', 'supply', 'type']);
    expect(dayOf('4-11-2026')).toBe('2026-11-04');
  });
  it("a sheet stored before this rule is shown with Fémini's share only", () => {
    const old = { id: 'STL-1', date: '2026-11-04', title: '', source: '', at: '', by: 'M', totals: { sales: 1000, cod: 870, shipping: 130, due: 870, vendoor: 600 }, rows: [{ ref: 'a', serial: '', type: 'collect', status: 3, total: 500, fees: 65, cod: 435, supply: 120, pieces: 2, date: '2026-11-04', note: '' }] } as unknown as Settlement;
    const s = supplyOnly(old);
    expect(s.totals).toEqual({ due: 870 });
    expect(s.rows[0]).toEqual({ ref: 'a', serial: '', type: 'collect', status: 3, supply: 120, pieces: 2, date: '2026-11-04', note: '' });
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
const EXPECT: Record<string, { date: string; rows: number; collect: number; ret: number; partial: number; adjust: number; due: number }> = {
  // named 31-11 (no such day); the sheet itself says "توريد يوم 31 أكتوبر"
  '31-11-2026': { date: '2026-10-31', rows: 55, collect: 39, ret: 14, partial: 2, adjust: 0, due: 34170 },
  '01-11-2026': { date: '2026-11-01', rows: 68, collect: 51, ret: 14, partial: 3, adjust: 0, due: 41150 },
  '02-11-2026': { date: '2026-11-02', rows: 74, collect: 58, ret: 10, partial: 5, adjust: 1, due: 48590 },
  '03-11-2026': { date: '2026-11-03', rows: 90, collect: 76, ret: 12, partial: 2, adjust: 0, due: 49510 },
  '04-11-2026': { date: '2026-11-04', rows: 92, collect: 71, ret: 14, partial: 6, adjust: 1, due: 42765 },
  '05-11-2026': { date: '2026-11-05', rows: 90, collect: 65, ret: 22, partial: 2, adjust: 1, due: 38870 },
  '07-11-2026': { date: '2026-11-07', rows: 88, collect: 68, ret: 14, partial: 6, adjust: 0, due: 44480 },
};
describe.skipIf(!sheets.length)('the real settlement sheets', () => {
  for (const f of sheets) it(f, () => {
    const wb = XLSX.read(fs.readFileSync(`${dir}/${f}`), { type: 'buffer' });
    const p = parseSettlement(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }), f);
    const e = EXPECT[Object.keys(EXPECT).find((k) => f.includes(k))!];
    const n = (t: string) => p.rows.filter((r) => r.type === t).length;
    expect({ date: p.date, rows: p.rows.length, collect: n('collect'), ret: n('return'), partial: n('partial'), adjust: n('adjust'), due: p.totals.due }).toEqual(e);
    expect(Object.keys(p.totals)).toEqual(['due']);                  // nothing but Fémini's share is kept
    expect(p.rows.reduce((a, r) => a + r.supply, 0)).toBe(e.due);     // Fémini's due = its share of every order
    expect(!!p.dateNote).toBe(f.includes('31-11'));                 // the wrong name is pointed out
    expect(f).toContain(`( ${e.due.toLocaleString("en-US")} )`);   // the number in the file name
  });
});
