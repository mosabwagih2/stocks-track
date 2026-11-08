// Use the site normally, then put the backup back: on a copy of the LIVE data, through the copy of the server's rules.
// After the restore every number, order, document and setting is exactly as in the backup, and a page that was open before
// the restore cannot save on top of it. Needs FEMINI_LIVE_BOOT; skipped otherwise.
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createMemoryRepo } from '../memory';
import { setActor } from '../repo';
import { createServerBackend } from './backend';
import { createFakeServer, type FakeUser } from './fake-server';
import { mirrorFromBoot, toLovable, type Boot } from './v3';
import { qty } from '@/femini/domain/ledger';
import { cairoToday } from '@/femini/domain/dates';

const path = process.env.FEMINI_LIVE_BOOT;
const boot = path && fs.existsSync(path) ? (JSON.parse(fs.readFileSync(path, 'utf8')) as Boot) : null;
const ADMIN: FakeUser = { id: 'u1', name: 'Mosab', role: 'admin', perms: [] };
afterEach(() => setActor(null));

/** what a fresh page load shows: every row and setting, compared as data */
const view = (b: Boot) => {
  const S = toLovable(mirrorFromBoot(b));
  return { moves: S.moves.map((m) => [m.id, m.sku, m.qty, m.from, m.to, m.doc, m.date]), orders: S.orders, docs: S.docs.map((d) => [d.no, d.status, d.date, d.lines]), pickups: S.pickups, holds: S.holds, closes: S.closes, lock: S.lock, seq: S.seq, cat: S.cat };
};

describe.skipIf(!boot)('restore from a backup (live data)', () => {
  it('real work after the backup is undone exactly, and an old page cannot save over it', async () => {
    const srv = createFakeServer(boot!, ADMIN);
    const backup = structuredClone(srv.bootNow().state);   // what the backup file holds
    const before = view(srv.bootNow());
    setActor(ADMIN.name);
    const r = createMemoryRepo(createServerBackend(srv.bootNow(), srv.transport));
    // ---- normal use: a pickup, its scan, a state change, a cancellation
    let s = await r.snapshot();
    const ready = s.skus.filter((k) => qty(s.balances, k.id, 'READY') >= 5).map((k) => k.id);
    await r.importPickup({ label: 'تيست', date: cairoToday(), channel: 'VENDOOR', source: 't.xlsx', orders: [{ ref: 'tt0001', waybill: '9', type: 'new', gov: '', total: 0, lines: [ready[0], ready[1]], unmapped: [] }] });
    await r.shipOrders({ refs: ['tt0001'], employee: ADMIN.name, source: 's.csv' });
    await r.postOp({ type: 'CLN', date: cairoToday(), hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku: ready[2], q: 2 }] });
    const open = s.orders.find((o) => o.status === 'shipped' && !o.returned)!;
    await r.cancelOrder({ code: open.ref, reason: 'تيست', returnStock: true, photo: new File(['x'], 'p.jpg', { type: 'image/jpeg' }) });
    s = await r.snapshot();
    expect(s.moves.length).toBeGreaterThan(before.moves.length);
    expect(view(srv.bootNow())).not.toEqual(before);

    // ---- the restore
    srv.restore(backup);
    expect(view(srv.bootNow())).toEqual(before);   // exactly the backup again

    // ---- the page opened before the restore: its next save is refused, nothing is written
    const revAfter = srv.rev;
    await expect(r.postOp({ type: 'CLN', date: cairoToday(), hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku: ready[3], q: 1 }] })).rejects.toThrow(/اترجعت/);
    expect(srv.rev).toBe(revAfter);
    expect(view(srv.bootNow())).toEqual(before);

    // ---- a page opened after the restore works normally
    const r2 = createMemoryRepo(createServerBackend(srv.bootNow(), srv.transport));
    const done = await r2.postOp({ type: 'CLN', date: cairoToday(), hdr: { from: 'READY', to: 'DIRTY' }, lines: [{ sku: ready[3], q: 1 }] });
    expect(done.pieces).toBe(1);
    expect(srv.rev).toBeGreaterThan(revAfter);
  }, 120_000);
});
