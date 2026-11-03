import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import seed from '../data/seed.json';
import { allocate, findByCode } from './orders';
import { balancesFromMoves, locTotal, qty } from './ledger';
import { matchScans, parseCsv, parseScan } from './scan';
import { consumption, dailyUse, supplyStatus } from './supplies';
import { parsePickupRows } from './pickup';
import { addDays, cairoToday, dayDiff } from './dates';
import type { Order, Pickup, Sku, Supply, SupplyEntry } from './types';

const skus: Sku[] = seed.skus.map((k) => ({ id: k.id, model: k.m, color: k.c, size: k.s, minAlert: k.min ?? 0 }));
const opening = seed.skus.filter((k) => (k.open ?? 0) > 0).map((k) => ({ sku: k.id, qty: k.open!, from: 'EXT_OPEN' as const, to: 'READY' as const }));
const balances = balancesFromMoves(opening);
const pickups: Pickup[] = seed.pickups.map((p, i) => ({ id: `P${i + 1}`, label: p.label, date: seed.today, channel: 'VENDOOR', source: '' }));
const orders: Order[] = seed.pickups.flatMap((p, i) => p.orders.map((o) => ({
  ref: o.ref, waybill: String(o.wb), type: 'new' as const, gov: o.gov, total: o.total, lines: o.lines, unmapped: [], pickupId: `P${i + 1}`, status: 'open' as const,
})));

describe('ledger', () => {
  it('derives the opening balance from moves', () => {
    expect(locTotal(balances, 'READY')).toBe(43863);
    expect(qty(balances, 'BR2-BLK-L', 'READY')).toBeGreaterThan(0);
  });
  it('a transfer never creates or destroys pieces', () => {
    const b = balancesFromMoves([...opening, { sku: 'BR2-BLK-L', qty: 3, from: 'READY', to: 'DIRTY' }]);
    expect(locTotal(b, 'READY')).toBe(43860); expect(locTotal(b, 'DIRTY')).toBe(3);
    expect(locTotal(b, 'READY') + locTotal(b, 'DIRTY')).toBe(43863);
  });
});

describe('scan file (real QRbot export)', () => {
  const csv = readFileSync(resolve(__dirname, '../../../data/QRbot_202611021914566_scanned_orders.csv'), 'utf8');
  const scans = parseScan(parseCsv(csv));
  it('reads 28 scans and matches all of them by order code', () => {
    expect(scans).toHaveLength(28);
    const m = matchScans(scans, orders);
    expect(m.matched).toHaveLength(28); expect(m.unknown).toEqual([]); expect(m.duplicates).toEqual([]);
    const pieces = m.matched.reduce((a, r) => a + orders.find((o) => o.ref === r)!.lines.length, 0);
    expect(pieces).toBe(456);
  });
  it('detects duplicates, unknown codes and already shipped orders', () => {
    const shipped = orders.map((o) => (o.ref === scans[0].code ? { ...o, status: 'shipped' as const, shippedBy: 'x' } : o));
    const m = matchScans([...scans, scans[1], { code: 'nope99', time: '', name: '' }], shipped);
    expect(m.already).toHaveLength(1); expect(m.duplicates).toHaveLength(1); expect(m.unknown).toEqual(['nope99']);
  });
  it('rejects a file without a code column', () => { expect(() => parseScan([['a', 'b'], ['1', '2']])).toThrow(); });
  it('parses quoted CSV fields', () => { expect(parseCsv('a,"b,c","d""e"\r\n1,2,3')).toEqual([['a', 'b,c', 'd"e'], ['1', '2', '3']]); });
});

describe('stuck orders (allocation)', () => {
  it('nothing is stuck while stock covers the demand', () => {
    const { blocked, demand } = allocate(orders.slice(0, 5), pickups, balances);
    expect(blocked.size).toBe(0); expect(Object.keys(demand).length).toBeGreaterThan(0);
  });
  it('an order is stuck when any variant is short, and stuck orders do not eat stock', () => {
    const b = { 'A-1': { READY: 1 }, 'B-1': { READY: 0 } };
    const os: Order[] = [
      { ...orders[0], ref: 'o1', lines: ['A-1', 'B-1'] }, // B short -> stuck, must not consume A
      { ...orders[0], ref: 'o2', lines: ['A-1'] },        // can still use the single A
      { ...orders[0], ref: 'o3', lines: ['A-1'] },        // A gone -> stuck
    ];
    const { blocked } = allocate(os, pickups, b);
    expect([...blocked.keys()].sort()).toEqual(['o1', 'o3']);
    expect(blocked.get('o1')).toEqual([{ sku: 'B-1', short: 1 }]);
  });
  it('finds orders by code or waybill and ignores the # on labels', () => {
    expect(findByCode(orders, 'ED4298#')?.ref).toBe('ed4298');
    expect(findByCode(orders, '23793621')?.ref).toBe('fd8523');
    expect(findByCode(orders, 'zzz')).toBeUndefined();
  });
});

describe('supplies', () => {
  const supplies: Supply[] = [
    { id: 'FLY', name: 'f', unit: 'u', pack: 1, packName: '', minAlert: 0, note: '', archived: false, rule: { kind: 'order', qty: 1 } },
    { id: 'PKS', name: 's', unit: 'u', pack: 1, packName: '', minAlert: 0, note: '', archived: false, rule: { kind: 'range', qty: 1, from: 1, to: 2 } },
    { id: 'PKL', name: 'l', unit: 'u', pack: 1, packName: '', minAlert: 0, note: '', archived: false, rule: { kind: 'range', qty: 1, from: 6, to: 0 } },
    { id: 'CUP', name: 'c', unit: 'u', pack: 24, packName: 'bag', minAlert: 0, note: '', archived: false, rule: { kind: 'pieces', qty: 2, model: 'BR1' } },
  ];
  const modelOf = (s: string) => s.split('-')[0];
  it('applies order, range and per-piece rules', () => {
    expect(consumption(['PAN3-A-S', 'BR1-A-S', 'BR1-B-S'], supplies, modelOf)).toEqual([{ item: 'FLY', qty: 1 }, { item: 'CUP', qty: 4 }]);
    expect(consumption(Array(7).fill('PAN3-A-S'), supplies, modelOf).map((x) => x.item)).toEqual(['FLY', 'PKL']);
    expect(consumption(['PAN3-A-S'], supplies, modelOf).map((x) => x.item)).toEqual(['FLY', 'PKS']);
  });
  it('status and daily use', () => {
    const log: SupplyEntry[] = [{ id: 1, date: '2026-11-02', item: 'FLY', qty: -70, kind: 'auto', why: '', doc: null, by: '', reversed: false }];
    expect(dailyUse(log, 'FLY', '2026-11-02', 7)).toBe(10);
    expect(supplyStatus(supplies[0], 0, 0)).toBe('crit');
    expect(supplyStatus(supplies[0], 50, 10)).toBe('warn');
    expect(supplyStatus(supplies[0], 500, 10)).toBe('good');
  });
});

describe('pickup import', () => {
  const rows = [
    ['كود الاوردر العشوائي', 'بوليصة الشحن', 'حالة الاوردر الجزئية', 'المحافظة', 'المبلغ توتال بالشحن للاوردر', 'المنتجات المطلوبة في الاوردر'],
    ['zz1', '777', 'اوردر جديد', 'القاهرة', '500', 'FC-BR2 ( Bra )-L-احمر-2, Women A5 ( x )-4XL-اسود-1, FC-NOPE ( y )-S-اسود-1'],
    ['ed4298', '1', 'جديد', 'x', '1', 'FC-BR2 ( Bra )-L-احمر-1'],
  ];
  it('maps items to SKUs, flags unknown models, skips duplicates', () => {
    const r = parsePickupRows(rows, skus, new Set(['ed4298']));
    expect(r.duplicates).toEqual(['ed4298']);
    expect(r.orders[0].lines).toEqual(['BR2-RED-L', 'BR2-RED-L', 'A5-BLK-4XL']);
    expect(r.unknownModels).toEqual(['FC-NOPE']); expect(r.orders[0].unmapped).toHaveLength(1);
  });
  it('refuses a sheet without the required columns', () => { expect(() => parsePickupRows([['a'], ['b']], skus, new Set())).toThrow(); });
});

describe('dates', () => {
  it('uses the Cairo calendar day', () => {
    expect(cairoToday(new Date('2026-11-02T21:30:00Z'))).toBe('2026-11-02'); // 23:30 Cairo
    expect(cairoToday(new Date('2026-11-02T22:30:00Z'))).toBe('2026-11-03'); // 00:30 Cairo
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01'); expect(dayDiff('2026-11-01', '2026-11-04')).toBe(3);
  });
});
