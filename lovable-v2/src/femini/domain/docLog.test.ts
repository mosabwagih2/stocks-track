import { describe, expect, it } from 'vitest';
import { docLog, flowText } from './docLog';
import type { Doc, Move, Order, Snapshot } from './types';

const mv = (id: number, ts: string, sku: string, qty: number, from: string, to: string, doc: string, by = 'Mosab') => ({ id, ts, date: ts.slice(0, 10), sku, qty, from, to, type: 'X', doc, by, note: '' }) as Move;
const doc = (no: string, type: string, hdr: Record<string, unknown> = {}, status: Doc['status'] = 'done') => ({ no, type, date: '2026-11-05', by: 'Mosab', status, hdr, lines: [{ sku: 'a', qty: 2 }, { sku: 'b', qty: 1 }] }) as Doc;
const snap = (x: Partial<Snapshot>) => ({ moves: [], supplyLog: [], supplies: [], orders: [], archivedPickups: [], files: [], docs: [], ...x }) as Snapshot;

describe('operation log', () => {
  it('one short line per event, in time order', () => {
    const d = doc('SHP-1', 'SHP', { at: '2026-11-05T08:00:00Z', deliveredAt: '2026-11-05T12:00:00Z' }, 'reversed');
    const s = snap({
      docs: [d, doc('SRT-1', 'SRT', { at: '2026-11-06T09:00:00Z', of: 'SHP-1' })],
      moves: [mv(1, '2026-11-05T08:00:01Z', 'a', 2, 'READY', 'EXT_SHOP', 'SHP-1'), mv(2, '2026-11-05T08:00:01Z', 'b', 1, 'READY', 'EXT_SHOP', 'SHP-1'),
        mv(3, '2026-11-07T10:00:00Z', 'a', 2, 'EXT_SHOP', 'READY', 'SHP-1 (عكس)', 'Ali'), mv(4, '2026-11-01T00:00:00Z', 'a', 9, 'READY', 'DIRTY', 'OTHER')],
      supplies: [{ id: 'bag', name: 'شنطة' }] as Snapshot['supplies'],
      supplyLog: [{ id: 1, date: '2026-11-05T08:00:02Z', item: 'bag', qty: -3, kind: 'auto', why: '', doc: 'SHP-1', by: 'Mosab', reversed: true }],
      files: [{ id: 'f', owner: 'SHP-1', kind: 'signed', name: 'note.jpg', mime: '', size: 1, at: '2026-11-05T12:00:00Z', path: '' }],
    });
    const log = docLog(s, d);
    expect(log.map((e) => [e.kind, e.label, e.detail, e.qty])).toEqual([
      ['create', 'توريد للمحل', '', 3],          // ready → shop is what «توريد للمحل» says: no from/to
      ['supply', 'مستلزمات', 'شنطة', 3],
      ['file', 'ملف', 'note.jpg', undefined],
      ['deliver', 'اتسلم للمحل', 'صورة الإذن الموقّع', undefined],
      ['link', 'مرتجع المحل', 'SRT-1', undefined],
      ['reverse', 'اتعكست', '', 2],
    ]);
    expect(log.at(-1)?.by).toBe('Ali');
  });
  it('shows where the pieces went only when the kind does not say it', () => {
    expect(flowText([{ from: 'EXT_FACTORY', to: 'READY', qty: 90 }])).toBe('');
    expect(flowText([{ from: 'DIRTY', to: 'FACTORY', qty: 4 }])).toBe('نظافة ← المصنع');
    expect(flowText([{ from: 'EXT_CH', to: 'READY', qty: 10 }, { from: 'EXT_CH', to: 'DIRTY', qty: 2 }])).toBe('العميل ← جاهز 10، العميل ← نظافة 2');
  });
  it('lists the orders a scan shipped, a return brought back, and waybills typed in by hand', () => {
    const o = (ref: string, x: Partial<Order>) => ({ ref, ...x }) as Order;
    const s = snap({ orders: [o('a1', { shipDoc: 'SCN-1', shippedAt: '2026-11-05T09:00:00Z', shippedBy: 'Abdallah' }), o('a2', { shipDoc: 'SCN-1', shippedAt: '2026-11-05T08:30:00Z' }), o('a3', { returned: { doc: 'RTN-1', at: '2026-11-08T10:00:00Z' } })] });
    expect(docLog(s, doc('SCN-1', 'SCN')).find((e) => e.kind === 'order')).toMatchObject({ at: '2026-11-05T08:30:00Z', label: '2 أوردر', detail: 'a1، a2' });
    expect(docLog(s, doc('RTN-1', 'RTN')).find((e) => e.kind === 'order')).toMatchObject({ label: 'مرتجع', detail: 'a3', ref: 'a3' });
    expect(docLog(s, doc('RTN-2', 'RTN', { refs: ['man:ji5552', 'a3'] })).filter((e) => e.kind === 'order').map((e) => [e.label, e.detail])).toEqual([['2 بوليصة', 'ji5552 (يدوي)، a3']]);
  });
});
