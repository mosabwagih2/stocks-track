// Audit: pure business rules, one block per module. Each test states the behaviour a stock system must have.
import { describe, expect, it } from 'vitest';
import { balancesFromMoves, locTotal, qty, totalOwned } from './ledger';
import { buildOp, effects, expectedReturn } from './ops';
import { buildHoldOut, buildHoldSettle, daysOut, isOverdue, outstanding, type Hold } from './holds';
import { consumption, dailyUse, supplyBalance, supplyStatus } from './supplies';
import { allocate, findByCode, need } from './orders';
import { parsePickupRows } from './pickup';
import { matchScans, parseCsv, parseScan } from './scan';
import { addDays, cairoDay, cairoToday, dayDiff } from './dates';
import { backupDue, dayReport, financialReport } from './reports';
import { cellInfo } from './stock';
import { validateBackup } from '../data/backup';
import type { Balances, Move, Order, Pickup, Snapshot, Sku, Supply, SupplyEntry } from './types';

const T = '2026-11-07';
const mv = (sku: string, q: number, from: Move['from'], to: Move['to'], extra: Partial<Move> = {}): Move =>
  ({ id: 1, ts: `${T}T10:00:00Z`, date: T, sku, qty: q, from, to, type: 'X', doc: 'X-1', by: 'a', note: '', ...extra });
const bal = (b: Record<string, Partial<Record<'READY' | 'DIRTY' | 'FACTORY' | 'SCRAP' | 'LOST', number>>>): Balances => b;
const order = (ref: string, lines: string[], extra: Partial<Order> = {}): Order =>
  ({ ref, waybill: `W${ref}`, type: 'new', gov: '', total: 0, lines, unmapped: [], pickupId: 'P1', status: 'open', ...extra });

// ---------------------------------------------------------------- ledger
describe('ledger', () => {
  it('derives balances only for internal states and ignores external ones', () => {
    const b = balancesFromMoves([mv('A', 10, 'EXT_OPEN', 'READY'), mv('A', 3, 'READY', 'EXT_CH'), mv('A', 2, 'READY', 'DIRTY'), mv('A', 1, 'DIRTY', 'EXT_OFF')]);
    expect(b.A).toEqual({ READY: 5, DIRTY: 1 });
    expect(totalOwned(b, 'A')).toBe(6);
    expect(locTotal(b, 'READY')).toBe(5);
  });
  it('a move inside the warehouse keeps the total owned unchanged', () => {
    const b = balancesFromMoves([mv('A', 10, 'EXT_OPEN', 'READY'), mv('A', 4, 'READY', 'FACTORY'), mv('A', 1, 'FACTORY', 'SCRAP')]);
    expect(totalOwned(b, 'A')).toBe(10);
  });
  it('unknown SKU and empty ledger read as zero', () => {
    expect(qty({}, 'NOPE', 'READY')).toBe(0);
    expect(totalOwned({}, 'NOPE')).toBe(0);
  });
  it('is order independent (same moves in any order give the same balances)', () => {
    const ms = [mv('A', 10, 'EXT_OPEN', 'READY'), mv('A', 3, 'READY', 'DIRTY'), mv('B', 2, 'EXT_FACTORY', 'READY'), mv('A', 1, 'DIRTY', 'FACTORY')];
    expect(balancesFromMoves([...ms].reverse())).toEqual(balancesFromMoves(ms));
  });
});

// ---------------------------------------------------------------- operations
describe('buildOp: every operation type', () => {
  const b = bal({ A: { READY: 10, DIRTY: 4, FACTORY: 3, SCRAP: 2, LOST: 2 }, B: { READY: 1 } });
  const run = (type: Parameters<typeof buildOp>[0], hdr: Parameters<typeof buildOp>[1], lines: Parameters<typeof buildOp>[2], date = T) => buildOp(type, hdr, lines, b, date, T);

  it('RCV needs photo, declared total and an exact match', () => {
    expect(run('RCV', { declared: 5, hasPhoto: true }, [{ sku: 'A', q: 5 }]).ok).toBe(true);
    expect(run('RCV', { declared: 5, hasPhoto: false }, [{ sku: 'A', q: 5 }]).ok).toBe(false);
    expect(run('RCV', { declared: null, hasPhoto: true }, [{ sku: 'A', q: 5 }]).ok).toBe(false);
    expect(run('RCV', { declared: 6, hasPhoto: true }, [{ sku: 'A', q: 5 }]).ok).toBe(false);
    expect(run('RCV', { declared: 0, hasPhoto: true }, [{ sku: 'A', q: 0 }]).ok).toBe(false);
  });
  it('RCV ignores negative and fractional quantities instead of posting them', () => {
    const r = run('RCV', { declared: 2, hasPhoto: true }, [{ sku: 'A', q: 2.9 }, { sku: 'B', q: -4 }]);
    expect(r.moves).toEqual([expect.objectContaining({ sku: 'A', qty: 2 })]);
    expect(r.ok).toBe(true);
  });
  it('SHP needs a shop name and enough READY', () => {
    expect(run('SHP', { shop: 'محل' }, [{ sku: 'A', q: 10 }]).ok).toBe(true);
    expect(run('SHP', { shop: '  ' }, [{ sku: 'A', q: 1 }]).ok).toBe(false);
    expect(run('SHP', { shop: 'محل' }, [{ sku: 'A', q: 11 }]).ok).toBe(false);
  });
  it('the same SKU on two lines is checked against the balance together', () => {
    const r = run('SHP', { shop: 'محل' }, [{ sku: 'A', q: 6 }, { sku: 'A', q: 6 }]);
    expect(r.ok).toBe(false);
    expect(r.err.length).toBeGreaterThan(0);
  });
  it('CLN refuses same state on both sides and moves only what exists', () => {
    expect(run('CLN', { from: 'READY', to: 'READY' }, [{ sku: 'A', q: 1 }]).ok).toBe(false);
    expect(run('CLN', { from: 'DIRTY', to: 'SCRAP' }, [{ sku: 'A', q: 5 }]).ok).toBe(false);
    expect(run('CLN', { from: 'DIRTY', to: 'SCRAP' }, [{ sku: 'A', q: 4 }]).ok).toBe(true);
  });
  it('FSD wash takes from DIRTY, scrap takes from SCRAP', () => {
    expect(run('FSD', { kind: 'wash' }, [{ sku: 'A', q: 4 }]).moves[0]).toMatchObject({ from: 'DIRTY', to: 'FACTORY' });
    expect(run('FSD', { kind: 'scrap' }, [{ sku: 'A', q: 2 }]).moves[0]).toMatchObject({ from: 'SCRAP', to: 'EXT_FACTORY' });
    expect(run('FSD', { kind: 'scrap' }, [{ sku: 'A', q: 3 }]).ok).toBe(false);
  });
  it('FRC: good + rejected together cannot exceed what is at the factory', () => {
    expect(run('FRC', {}, [{ sku: 'A', q: 2, rej: 1 }]).ok).toBe(true);
    const r = run('FRC', {}, [{ sku: 'A', q: 2, rej: 2 }]);
    expect(r.ok).toBe(false);
  });
  it('LOS: found goes back to READY, otherwise written off; never more than LOST', () => {
    const r = run('LOS', {}, [{ sku: 'A', q: 1, res: 'FOUND' }, { sku: 'A', q: 1, res: 'OFF' }]);
    expect(r.ok).toBe(true);
    expect(r.moves.map((m) => m.to)).toEqual(['READY', 'EXT_OFF']);
    expect(run('LOS', {}, [{ sku: 'A', q: 2, res: 'FOUND' }, { sku: 'A', q: 1, res: 'OFF' }]).ok).toBe(false);
  });
  it('SWP keeps the total READY the same and refuses swapping more than READY', () => {
    const r = run('SWP', {}, [{ sku: 'A', q: 3, to: 'B' }]);
    expect(r.ok).toBe(true);
    const after = balancesFromMoves(r.moves.map((m) => ({ ...m })));
    expect((after.A?.READY ?? 0) + (after.B?.READY ?? 0)).toBe(0);
    expect(run('SWP', {}, [{ sku: 'B', q: 2, to: 'A' }]).ok).toBe(false);
    expect(run('SWP', {}, [{ sku: 'A', q: 1, to: 'A' }]).ok).toBe(false);
  });
  it('RTN: shortage becomes LOST, nothing counted twice, must be counted', () => {
    const r = run('RTN', { counted: true }, [{ sku: 'A', q: 0, exp: 5, r: 2, d: 1, x: 1 }]);
    expect(r.ok).toBe(true);
    expect(r.moves.map((m) => [m.to, m.qty])).toEqual([['READY', 2], ['DIRTY', 1], ['SCRAP', 1], ['LOST', 1]]);
    expect(r.moves.reduce((a, m) => a + m.qty, 0)).toBe(5);
    expect(run('RTN', { counted: false }, [{ sku: 'A', q: 0, exp: 1, r: 1 }]).ok).toBe(false);
  });
  it('RTN: more than expected is only a warning', () => {
    const r = run('RTN', { counted: true }, [{ sku: 'A', q: 0, exp: 1, r: 3 }]);
    expect(r.ok).toBe(true);
    expect(r.warn.length).toBeGreaterThan(0);
  });
  it('CNT posts only the difference, both directions, and needs reveal', () => {
    const r = run('CNT', { state: 'READY', cnt: { A: 7, B: 4 }, snap: { A: 10, B: 1 }, reveal: true }, []);
    expect(r.ok).toBe(true);
    expect(r.moves).toEqual([
      expect.objectContaining({ sku: 'A', qty: 3, from: 'READY', to: 'EXT_ADJ' }),
      expect.objectContaining({ sku: 'B', qty: 3, from: 'EXT_ADJ', to: 'READY' }),
    ]);
    expect(run('CNT', { state: 'READY', cnt: { A: 7 }, snap: { A: 10 }, reveal: false }, []).ok).toBe(false);
  });
  it('CNT with a balance that changed during counting needs an explicit acknowledgement', () => {
    const r = run('CNT', { state: 'READY', cnt: { A: 7 }, snap: { A: 9 }, reveal: true }, []);
    expect(r.ok).toBe(false);
    expect(run('CNT', { state: 'READY', cnt: { A: 7 }, snap: { A: 9 }, reveal: true, ack: true }, []).ok).toBe(true);
  });
  it('CNT with everything matching is valid and posts nothing', () => {
    const r = run('CNT', { state: 'READY', cnt: { A: 10 }, snap: { A: 10 }, reveal: true }, []);
    expect(r.ok).toBe(true);
    expect(r.moves).toEqual([]);
  });
  it('date: any past day, never the future (and no check line unless it fails)', () => {
    const ok = (d: string) => run('SHP', { shop: 'م' }, [{ sku: 'A', q: 1 }], d).ok;
    expect(ok(T)).toBe(true);
    expect(ok(addDays(T, -3))).toBe(true);
    expect(ok(addDays(T, -40))).toBe(true);
    expect(run('SHP', { shop: 'م' }, [{ sku: 'A', q: 1 }], T).checks.some((c) => /التاريخ/.test(c.t))).toBe(false);
    expect(ok(addDays(T, 1))).toBe(false);
  });
  it('effects shows before/after for every touched state', () => {
    const r = run('CLN', { from: 'READY', to: 'DIRTY' }, [{ sku: 'A', q: 2 }]);
    expect(effects(r.moves, b)).toEqual([{ sku: 'A', ch: [{ loc: 'READY', now: 10, after: 8 }, { loc: 'DIRTY', now: 4, after: 6 }] }]);
  });
  it('expectedReturn groups pieces per SKU across orders', () => {
    expect(expectedReturn([['A', 'A', 'B'], ['B']])).toEqual([
      { sku: 'A', q: 0, exp: 2, r: 2, d: 0, x: 0 }, { sku: 'B', q: 0, exp: 2, r: 2, d: 0, x: 0 }]);
  });
});

// ---------------------------------------------------------------- holds
describe('holds', () => {
  const b = bal({ A: { READY: 5 }, B: { READY: 2 } });
  const mk = (lines: { sku: string; q: number }[]): Hold => ({ no: 'HLD-1', who: 'x', note: '', reason: 'shoot', reasonText: '', at: `${T}T10:00:00Z`, date: T, by: 'a', lines, photo: 'p', status: 'open', events: [{ at: `${T}T10:00:00Z`, by: 'a', kind: 'out', lines, photo: 'p', note: '' }] });

  it('out needs name, photo, lines and READY stock', () => {
    expect(buildHoldOut({ who: 'x', reason: 'shoot', lines: [{ sku: 'A', q: 2 }], hasPhoto: true }, b).ok).toBe(true);
    expect(buildHoldOut({ who: ' ', reason: 'shoot', lines: [{ sku: 'A', q: 2 }], hasPhoto: true }, b).ok).toBe(false);
    expect(buildHoldOut({ who: 'x', reason: 'shoot', lines: [{ sku: 'A', q: 2 }], hasPhoto: false }, b).ok).toBe(false);
    expect(buildHoldOut({ who: 'x', reason: 'other', reasonText: '', lines: [{ sku: 'A', q: 2 }], hasPhoto: true }, b).ok).toBe(false);
    expect(buildHoldOut({ who: 'x', reason: 'shoot', lines: [{ sku: 'A', q: 6 }], hasPhoto: true }, b).ok).toBe(false);
  });
  it('out: the same SKU on two lines is checked against READY together', () => {
    const r = buildHoldOut({ who: 'x', reason: 'shoot', lines: [{ sku: 'A', q: 3 }, { sku: 'A', q: 3 }], hasPhoto: true }, b);
    expect(r.ok).toBe(false);
  });
  it('settle: partial return keeps it open, full settle closes it', () => {
    const h = mk([{ sku: 'A', q: 3 }]);
    const p = buildHoldSettle(h, { ret: [{ sku: 'A', q: 1, to: 'READY' }], off: [], hasPhoto: false });
    expect(p.ok).toBe(true); expect(p.closes).toBe(false); expect(p.remaining).toBe(2);
    const f = buildHoldSettle(h, { ret: [{ sku: 'A', q: 2, to: 'DIRTY' }], off: [{ sku: 'A', q: 1 }], hasPhoto: true });
    expect(f.ok).toBe(true); expect(f.closes).toBe(true);
  });
  it('settle: write-off needs a photo, and cannot exceed what is outside', () => {
    const h = mk([{ sku: 'A', q: 3 }]);
    expect(buildHoldSettle(h, { ret: [], off: [{ sku: 'A', q: 1 }], hasPhoto: false }).ok).toBe(false);
    expect(buildHoldSettle(h, { ret: [{ sku: 'A', q: 2, to: 'READY' }], off: [{ sku: 'A', q: 2 }], hasPhoto: true }).ok).toBe(false);
    expect(buildHoldSettle(h, { ret: [{ sku: 'B', q: 1, to: 'READY' }], off: [], hasPhoto: false }).ok).toBe(false);
  });
  it('settle: a returned piece must land in a real warehouse state', () => {
    const h = mk([{ sku: 'A', q: 1 }]);
    const r = buildHoldSettle(h, { ret: [{ sku: 'A', q: 1, to: 'BOGUS' as never }], off: [], hasPhoto: false });
    expect(r.ok).toBe(false);
  });
  it('outstanding and overdue', () => {
    const h = mk([{ sku: 'A', q: 3 }]); h.events.push({ at: '', by: '', kind: 'return', lines: [{ sku: 'A', q: 3 }], photo: null, note: '' });
    expect(outstanding(h)).toEqual({});
    const o = mk([{ sku: 'A', q: 1 }]);
    expect(daysOut(o, new Date(`${addDays(T, 7)}T10:00:00Z`))).toBe(7);
    expect(isOverdue(o, new Date(`${addDays(T, 6)}T09:00:00Z`))).toBe(false);
    expect(isOverdue(o, new Date(`${addDays(T, 7)}T10:00:00Z`))).toBe(true);
  });
});

// ---------------------------------------------------------------- supplies
describe('supplies', () => {
  const sup = (id: string, rule: Supply['rule'], archived = false): Supply => ({ id, name: id, unit: 'u', pack: 1, packName: '', minAlert: 0, note: '', archived, rule });
  const S = [sup('FLY', { kind: 'order', qty: 1 }), sup('PKS', { kind: 'range', qty: 1, from: 1, to: 2 }), sup('PKM', { kind: 'range', qty: 1, from: 3, to: 5 }), sup('PKL', { kind: 'range', qty: 1, from: 6, to: 0 }), sup('CUP', { kind: 'pieces', qty: 2, model: 'BR1' }), sup('OLD', { kind: 'order', qty: 1 }, true)];
  const modelOf = (s: string) => s.split('-')[0];
  const items = (lines: string[]) => Object.fromEntries(consumption(lines, S, modelOf).map((c) => [c.item, c.qty]));

  it('exactly one packaging size per order at every boundary', () => {
    for (let n = 1; n <= 12; n++) {
      const c = items(Array(n).fill('X-1'));
      const packs = ['PKS', 'PKM', 'PKL'].filter((k) => c[k]);
      expect(packs.length, `order with ${n} pieces`).toBe(1);
    }
  });
  it('flyer per order, cups per BR1 piece only, archived supplies ignored', () => {
    expect(items(['BR1-a', 'BR1-b', 'D2-a'])).toEqual({ FLY: 1, PKM: 1, CUP: 4 });
  });
  it('balance, daily use (reversals subtract) and status', () => {
    const log: SupplyEntry[] = [
      { id: 1, date: addDays(T, -10), item: 'FLY', qty: 100, kind: 'open', why: '', doc: null, by: '', reversed: false },
      { id: 2, date: T, item: 'FLY', qty: -14, kind: 'auto', why: '', doc: 'SCN-1', by: '', reversed: true },
      { id: 3, date: T, item: 'FLY', qty: 7, kind: 'rev', why: 'reverse SCN-1', doc: 'SCN-1 (عكس)', by: '', reversed: false },
    ];
    expect(supplyBalance(log, 'FLY')).toBe(93);
    expect(dailyUse(log, 'FLY', T)).toBe(1);
    expect(supplyStatus(sup('FLY', { kind: 'none' }), 93, 1)).toBe('good');
    expect(supplyStatus(sup('FLY', { kind: 'none' }), 6, 1)).toBe('warn');
    expect(supplyStatus(sup('FLY', { kind: 'none' }), 0, 0)).toBe('crit');
  });
  it('daily use also subtracts the refund of a cancelled order', () => {
    const log: SupplyEntry[] = [
      { id: 2, date: T, item: 'FLY', qty: -7, kind: 'auto', why: '', doc: 'SCN-1', by: '', reversed: false },
      { id: 3, date: T, item: 'FLY', qty: 7, kind: 'rev', why: 'إلغاء أوردر X', doc: 'CXL-0001', by: '', reversed: false },
    ];
    expect(dailyUse(log, 'FLY', T)).toBe(0);
  });
});

// ---------------------------------------------------------------- orders
describe('orders: allocation and lookup', () => {
  const pickups: Pickup[] = [{ id: 'P1', label: '', date: T, channel: '', source: '' }, { id: 'P2', label: '', date: T, channel: '', source: '' }];
  it('older pickups are served first, a short bundle blocks without consuming stock', () => {
    const b = bal({ A: { READY: 1 }, B: { READY: 1 } });
    const os = [order('late', ['A'], { pickupId: 'P2' }), order('big', ['A', 'B', 'B'], { pickupId: 'P1' }), order('small', ['B'], { pickupId: 'P1' })];
    const { blocked, demand } = allocate(os, pickups, b);
    // big (P1) is short of B and blocks without taking A; small (P1) gets B; late (P2) still gets A
    expect([...blocked.keys()]).toEqual(['big']);
    expect(demand).toEqual({ A: 2, B: 3 });
  });
  it('blocked bundle reports how many pieces are short', () => {
    const b = bal({ A: { READY: 1 }, B: { READY: 1 } });
    const { blocked } = allocate([order('big', ['A', 'B', 'B']), order('next', ['A'])], pickups, b);
    expect(blocked.get('big')).toEqual([{ sku: 'B', short: 1 }]);
    expect(blocked.has('next')).toBe(false);
  });
  it('negative READY reports the full need as short', () => {
    const { blocked } = allocate([order('o', ['A', 'A'])], pickups, bal({ A: { READY: -3 } }));
    expect(blocked.get('o')).toEqual([{ sku: 'A', short: 2 }]);
  });
  it('need counts pieces per SKU', () => expect(need({ lines: ['A', 'B', 'A'] })).toEqual({ A: 2, B: 1 }));
  it('findByCode: ref or waybill, case, spaces and # ignored', () => {
    const os = [order('ab12', [], { waybill: '123 456' })];
    expect(findByCode(os, ' #AB12 ')?.ref).toBe('ab12');
    expect(findByCode(os, '123456')?.ref).toBe('ab12');
    expect(findByCode(os, '')).toBeUndefined();
  });
});

// ---------------------------------------------------------------- pickup sheet import
describe('pickup sheet parser', () => {
  const skus: Sku[] = [{ id: 'BR2-BLK-L', model: 'BR2', color: 'اسود', size: 'L', minAlert: 0 }, { id: 'A5-RED-M', model: 'A5', color: 'احمر', size: 'M', minAlert: 0 }];
  const head = ['كود الاوردر العشوائي', 'بوليصة الشحن', 'حالة الاوردر الجزئية', 'المحافظة', 'المبلغ توتال بالشحن للاوردر', 'المنتجات المطلوبة في الاوردر'];
  it('maps items with quantity, FC- prefix and Women A5 alias', () => {
    const r = parsePickupRows([head, ['o1', 111, 'جديد', 'القاهرة', 500, 'FC-BR2 ( برا )-L-اسود-2, Women A5 ( بدي )-M-احمر-1']], skus, new Set());
    expect(r.orders[0].lines).toEqual(['BR2-BLK-L', 'BR2-BLK-L', 'A5-RED-M']);
    expect(r.orders[0].unmapped).toEqual([]);
  });
  it('unknown model or variant is kept as unmapped, never guessed', () => {
    const r = parsePickupRows([head, ['o1', 1, '', '', 0, 'FC-BR2 ( برا )-XL-اسود-1, ZZZ ( x )-L-اسود-1, garbage']], skus, new Set());
    expect(r.orders[0].lines).toEqual([]);
    expect(r.orders[0].unmapped.length).toBe(3);
    expect(r.unknownModels).toEqual(['ZZZ']);
  });
  it('duplicates against existing and inside the same file', () => {
    const r = parsePickupRows([head, ['o1', 1, '', '', 0, ''], ['o1', 1, '', '', 0, ''], ['o2', 1, '', '', 0, '']], skus, new Set(['o2']));
    expect(r.orders.map((o) => o.ref)).toEqual(['o1']);
    expect(r.duplicates).toEqual(['o1', 'o2']);
  });
  it('exchange orders are typed as exchange', () => {
    expect(parsePickupRows([head, ['o1', 1, 'استبدال', '', 0, '']], skus, new Set()).orders[0].type).toBe('exchange');
  });
  it('refuses a sheet without the required columns', () => {
    expect(() => parsePickupRows([['a', 'b']], skus, new Set())).toThrow();
  });
  it('a colour name with a hyphen is mapped, not lost', () => {
    const s2: Sku[] = [{ id: 'BR2-OW-L', model: 'BR2', color: 'اوف-وايت', size: 'L', minAlert: 0 }];
    const r = parsePickupRows([head, ['o1', 1, '', '', 0, 'FC-BR2 ( برا )-L-اوف-وايت-1']], s2, new Set());
    expect(r.orders[0].lines).toEqual(['BR2-OW-L']);
  });
});

// ---------------------------------------------------------------- scanner file
describe('scanner CSV', () => {
  it('reads quotes, escaped quotes, CRLF and blank lines', () => {
    expect(parseCsv('a,"b,""c"""\r\n\r\n1,2\n')).toEqual([['a', 'b,"c"'], ['1', '2']]);
  });
  it('reads the QRbot export', () => {
    const rows = parseScan(parseCsv('DATE,QUANTITY,NAME,CODECONTENT,CODETYPE\n2026-11-02 18:05:36 +0200,1,"","so5178",6\n'));
    expect(rows).toEqual([{ code: 'so5178', time: '2026-11-02 18:05:36', name: '' }]);
  });
  it('refuses a file with no code column', () => expect(() => parseScan([['x', 'y']])).toThrow());
  it('classifies matched, duplicate, already shipped, unknown, unmapped, cancelled', () => {
    const os = [order('a1', ['A']), order('b2', ['A'], { status: 'shipped', shippedBy: 'm' }), order('c3', [], { unmapped: [['x']] }), order('d4', ['A'], { status: 'cancelled' })];
    const r = matchScans(['A1', 'a1', 'Wa1', 'b2', 'c3', 'zz', 'd4'].map((code) => ({ code, time: '', name: '' })), os);
    expect(r.matched).toEqual(['a1']);
    expect(r.duplicates).toEqual(['a1']);
    expect(r.already).toEqual([{ ref: 'b2', by: 'm' }]);
    expect(r.unmapped).toEqual(['c3']);
    expect(r.unknown).toEqual(['zz', 'd4']);
  });
});

// ---------------------------------------------------------------- dates
describe('dates (Cairo work day)', () => {
  it('Cairo day differs from UTC around midnight, winter and summer time', () => {
    expect(cairoToday(new Date('2026-01-10T22:30:00Z'))).toBe('2026-01-11');   // UTC+2
    expect(cairoToday(new Date('2026-07-10T21:30:00Z'))).toBe('2026-07-11');   // UTC+3 (summer time)
    expect(cairoToday(new Date('2026-07-10T20:30:00Z'))).toBe('2026-07-10');
    expect(cairoDay('2026-11-06T22:30:00.000Z')).toBe('2026-11-07');
  });
  it('addDays and dayDiff across month, year and leap day', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
    expect(dayDiff('2026-10-25', '2026-11-07')).toBe(13);
  });
});

// ---------------------------------------------------------------- reports
describe('reports', () => {
  const snap = (moves: Move[], orders: Order[] = [], pickups: Pickup[] = []) => ({ moves, orders, pickups } as unknown as Snapshot);
  it('day report: shipped minus reversed, received, team counts', () => {
    const r = dayReport(snap([
      mv('A', 10, 'EXT_OPEN', 'READY', { date: addDays(T, -1) }),
      mv('A', 4, 'READY', 'EXT_CH', { type: 'SCN', by: 'sara' }),
      mv('A', 1, 'EXT_CH', 'READY', { type: 'SCN', by: 'sara' }),
      mv('A', 5, 'EXT_FACTORY', 'READY', { type: 'RCV' }),
    ]), T);
    expect(r.summary.shipped).toBe(3);
    expect(r.summary.received).toBe(5);
    expect(r.summary.ready).toBe(12);
    expect(r.team).toEqual([['sara', 3]]);
  });
  it('day report: "returned" counts only pieces that physically came back, not the missing ones', () => {
    const r = dayReport(snap([
      mv('A', 3, 'EXT_CH', 'READY', { type: 'RTN' }),
      mv('A', 2, 'EXT_CH', 'LOST', { type: 'RTN' }),
    ]), T);
    expect(r.summary.returned).toBe(3);
  });
  it('day report rebuilds order status as it was at the end of that day', () => {
    const p: Pickup[] = [{ id: 'P1', label: '', date: addDays(T, -1), channel: '', source: '' }];
    const o = order('x', ['A'], { status: 'shipped', shippedAt: `${T}T09:00:00Z` });
    expect(dayReport(snap([], [o], p), addDays(T, -1)).open).toBe(1);
    expect(dayReport(snap([], [o], p), T).open).toBe(0);
  });
  it('financial report: missing costs are disclosed, negative balances listed', () => {
    const s = { moves: [mv('A', 10, 'EXT_OPEN', 'READY'), mv('B', 2, 'READY', 'EXT_CH')], skus: [{ id: 'A', model: 'M1', color: '', size: '', minAlert: 0 }, { id: 'B', model: 'M2', color: '', size: '', minAlert: 0 }], archivedSkus: [], models: [], costs: { M1: { cost: 50, price: 100 } } } as unknown as Snapshot;
    const f = financialReport(s);
    expect(f.ready.known).toBe(500);
    expect(f.ready.missing).toBe(1);
    expect(f.negative).toEqual(['B']);
  });
  it('backup reminder after 7 days or when never backed up', () => {
    const now = Date.parse(`${T}T12:00:00Z`);
    expect(backupDue(null, now)).toBe(true);
    expect(backupDue('garbage', now)).toBe(true);
    expect(backupDue(`${addDays(T, -6)}T12:00:00Z`, now)).toBe(false);
    expect(backupDue(`${addDays(T, -8)}T12:00:00Z`, now)).toBe(true);
  });
});

// ---------------------------------------------------------------- stock cell
describe('stock alert levels', () => {
  const sku: Sku = { id: 'A', model: 'M', color: '', size: '', minAlert: 5 };
  it('critical when demand exceeds READY, warning under the minimum, quiet otherwise', () => {
    expect(cellInfo(sku, bal({ A: { READY: 2 } }), { A: 3 }, {}, false, 14).level).toBe('crit');
    expect(cellInfo(sku, bal({ A: { READY: 6 } }), { A: 2 }, {}, false, 14).level).toBe('warn');
    expect(cellInfo(sku, bal({ A: { READY: 10 } }), {}, {}, false, 14).level).toBe('');
  });
  it('with sales speed: out of stock with movement is critical, slow movers are surplus', () => {
    expect(cellInfo(sku, bal({ A: { READY: 0 } }), {}, { A: 1 }, true, 14).level).toBe('crit');
    expect(cellInfo(sku, bal({ A: { READY: 100 } }), {}, { A: 1 }, true, 14).surplus).toBe(true);
  });
});

// ---------------------------------------------------------------- backup validation
describe('backup validation', () => {
  const good = () => ({ app: 'femini-stock-dashboard', version: 1, at: '', media: {}, state: { v: 2, moves: [{ id: 1, ts: `${T}T10:00:00Z`, date: T, sku: 'A', qty: 1, from: 'EXT_OPEN', to: 'READY', type: 'OPN', doc: 'OPN-1' }], orders: [], docs: [], pickups: [], supplies: [], log: [], seq: {}, images: {}, cat: { skus: [], models: [], archived: {}, names: {}, colors: [], sizes: [] } } });
  it('accepts a complete backup', () => expect(() => validateBackup(good())).not.toThrow());
  it('refuses duplicate move ids, negative quantities, unknown states, bad dates', () => {
    const dup = good(); dup.state.moves.push({ ...dup.state.moves[0] }); expect(() => validateBackup(dup)).toThrow();
    const neg = good(); neg.state.moves[0].qty = -1; expect(() => validateBackup(neg)).toThrow();
    const loc = good(); loc.state.moves[0].to = 'NOWHERE'; expect(() => validateBackup(loc)).toThrow();
    const date = good(); date.state.moves[0].date = '07-11-2026'; expect(() => validateBackup(date)).toThrow();
  });
  it('refuses fractional piece quantities', () => {
    const f = good(); f.state.moves[0].qty = 1.5; expect(() => validateBackup(f)).toThrow();
  });
  it('refuses a Brand 2 file and points to the import preview', () => expect(() => validateBackup({ app: 'femini-stock' })).toThrow(/Brand 2/));
});
