import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { lostOrders } from './lost';
import { mirrorFromBoot, toLovable, type Boot } from '@/femini/data/cpanel/v3';
import type { Doc, Move, Order } from './types';

const order = (ref: string, lines: string[]): Order => ({ ref, waybill: `9${ref}`, type: 'new', gov: '', total: 0, lines, unmapped: [], pickupId: 'P1', status: 'shipped' });
const rtn = (no: string, lines: { sku: string; exp: number; r: number }[], refs: string[], hdr: Record<string, unknown> = {}): Doc =>
  ({ no, type: 'RTN', date: '2026-11-07', by: 'A', status: 'done', hdr: { refs, ...hdr }, lines: lines.map((l) => ({ ...l, d: 0, x: 0, qty: 0 })) as unknown as Doc['lines'], attachment: null });
const mv = (doc: string, sku: string, qty: number, from: string, to: string, note = ''): Move => ({ id: 1, ts: '', date: '2026-11-07', sku, qty, from: from as Move['from'], to: to as Move['to'], type: 'RTN', doc, by: 'A', note });

describe('lost pieces per order', () => {
  it('a return of this app: the missing piece goes on the order that has it', () => {
    const os = [order('a1', ['X', 'Y']), order('b2', ['Z'])];
    const r = lostOrders([rtn('RTN-1', [{ sku: 'X', exp: 1, r: 0 }, { sku: 'Y', exp: 1, r: 1 }, { sku: 'Z', exp: 1, r: 1 }], ['a1', 'b2'])], os, [mv('RTN-1', 'X', 1, 'EXT_CH', 'LOST')]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ ref: 'a1', orderNo: '9a1', doc: 'RTN-1' });
    expect(r[0].items).toEqual([{ sku: 'X', missing: true }, { sku: 'Y', missing: false }]);
    expect(r[0].shared).toBeUndefined();
  });
  it('two orders of the same return have the sku: shown on both, marked shared (never guessed)', () => {
    const os = [order('a1', ['X']), order('b2', ['X'])];
    const r = lostOrders([rtn('RTN-1', [{ sku: 'X', exp: 2, r: 1 }], ['a1', 'b2'])], os, [mv('RTN-1', 'X', 1, 'EXT_CH', 'LOST')]);
    expect(r.map((x) => [x.ref, x.shared])).toEqual([['a1', ['b2']], ['b2', ['a1']]]);
  });
  it('the original app\'s parcels, and a later write-off settles the oldest piece', () => {
    const d = rtn('RTN-2', [], [], { parcels: [{ ref: 'pt1', wb: '2356', items: [{ sku: 'X', st: 'm' }, { sku: 'Y', st: 'r' }] }] });
    const r = lostOrders([d], [], [mv('RTN-2', 'X', 1, 'EXT_CH', 'LOST'), mv('LOS-1', 'X', 1, 'LOST', 'EXT_OFF')]);
    expect(r[0]).toMatchObject({ ref: 'pt1', orderNo: '2356' });
    expect(r[0].items).toEqual([{ sku: 'X', missing: true, settled: true }, { sku: 'Y', missing: false }]);
  });
  it('a correction\'s lost move names the order in its note', () => {
    const r = lostOrders([], [order('xk6669', ['X'])], [mv('RTN-9', 'X', 1, 'READY', 'LOST', 'تعديل RTN-3 · xk6669')]);
    expect(r[0]).toMatchObject({ ref: 'xk6669', doc: 'RTN-9' });
  });
});

const path = process.env.FEMINI_LIVE_BOOT;
const boot = path && fs.existsSync(path) ? (JSON.parse(fs.readFileSync(path, 'utf8')) as Boot) : null;
describe.skipIf(!boot)('lost pieces on the live data', () => {
  it('every lost piece in the ledger is on an order with its waybill', () => {
    const S = toLovable(mirrorFromBoot(boot!));
    const r = lostOrders(S.docs, S.orders, S.moves);
    const inLedger = S.moves.filter((m) => m.to === 'LOST').reduce((a, m) => a + m.qty, 0);
    const shown = r.filter((x) => !x.shared).reduce((a, x) => a + x.items.filter((i) => i.missing).length, 0);
    console.log(r.map((x) => `${x.ref || '?'} (${x.orderNo}) ${x.doc}: ${x.items.filter((i) => i.missing).map((i) => i.sku).join(', ')}${x.shared ? ' [shared]' : ''}`).join('\n'));
    expect(r.every((x) => x.ref)).toBe(true);
    expect(shown).toBe(inLedger);
  });
});
