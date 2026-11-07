import { describe, expect, it } from 'vitest';
import { buildHoldOut, buildHoldSettle, isOverdue, outstanding, type Hold } from './holds';

const b = { 'X-M': { READY: 5 } } as never;
const hold = (): Hold => ({ no: 'HLD-0001', who: 'سارة', note: '', reason: 'shoot', reasonText: '', at: '2026-11-01T10:00:00Z', date: '2026-11-01', by: 't', lines: [{ sku: 'X-M', q: 3 }], photo: 'p', status: 'open', events: [{ at: '2026-11-01T10:00:00Z', by: 't', kind: 'out', lines: [{ sku: 'X-M', q: 3 }], photo: 'p', note: '' }] });

describe('hold', () => {
  it('taking out needs a person and a handover photo, and moves READY to hold', () => {
    expect(buildHoldOut({ who: 'سارة', reason: 'shoot', lines: [{ sku: 'X-M', q: 3 }], hasPhoto: false }, b).ok).toBe(false);
    expect(buildHoldOut({ who: '', reason: 'shoot', lines: [{ sku: 'X-M', q: 3 }], hasPhoto: true }, b).ok).toBe(false);
    const r = buildHoldOut({ who: 'سارة', reason: 'shoot', lines: [{ sku: 'X-M', q: 3 }], hasPhoto: true }, b);
    expect(r.moves).toEqual([expect.objectContaining({ qty: 3, from: 'READY', to: 'EXT_HOLD' })]);
    expect(buildHoldOut({ who: 'سارة', reason: 'shoot', lines: [{ sku: 'X-M', q: 6 }], hasPhoto: true }, b).ok).toBe(false);
  });
  it('a write-off cannot be confirmed without a proof photo', () => {
    expect(buildHoldSettle(hold(), { ret: [], off: [{ sku: 'X-M', q: 1 }], hasPhoto: false }).ok).toBe(false);
    expect(buildHoldSettle(hold(), { ret: [], off: [{ sku: 'X-M', q: 1 }], hasPhoto: true }).ok).toBe(true);
  });
  it('partial return keeps the hold open; returning the rest closes it', () => {
    const r = buildHoldSettle(hold(), { ret: [{ sku: 'X-M', q: 2, to: 'READY' }], off: [], hasPhoto: false });
    expect(r.ok && !r.closes && r.remaining === 1).toBe(true);
    expect(buildHoldSettle(hold(), { ret: [{ sku: 'X-M', q: 2, to: 'READY' }], off: [{ sku: 'X-M', q: 1 }], hasPhoto: true }).closes).toBe(true);
    expect(buildHoldSettle(hold(), { ret: [{ sku: 'X-M', q: 4, to: 'READY' }], off: [], hasPhoto: false }).ok).toBe(false);
    const h = hold(); h.events.push({ at: '', by: '', kind: 'return', lines: [{ sku: 'X-M', q: 2 }], photo: null, note: '' });
    expect(outstanding(h)).toEqual({ 'X-M': 1 });
  });
  it('is overdue after 7 days', () => {
    expect(isOverdue(hold(), new Date('2026-11-07T09:00:00Z'))).toBe(false);
    expect(isOverdue(hold(), new Date('2026-11-08T10:00:00Z'))).toBe(true);
  });
});
