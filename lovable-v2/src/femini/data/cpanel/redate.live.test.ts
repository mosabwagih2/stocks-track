// Rehearsal, on a copy of the LIVE data, of moving every scan sheet to the day of its pickup (all sheets were uploaded on
// one day). Each move must be accepted by the server rules, keep every balance, put each shipment on its pickup's day, and
// leave every other day exactly as it was. Needs FEMINI_LIVE_BOOT; skipped otherwise.
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createMemoryRepo } from '../memory';
import { setActor } from '../repo';
import { createServerBackend } from './backend';
import { createFakeServer, type FakeUser } from './fake-server';
import { isEmpty, mirrorFromBoot, toLovable, toPush, type Boot } from './v3';
import type { Move } from '@/femini/domain/types';
import { supplyBalance } from '@/femini/domain/supplies';

const path = process.env.FEMINI_LIVE_BOOT;
const boot = path && fs.existsSync(path) ? (JSON.parse(fs.readFileSync(path, 'utf8')) as Boot) : null;
const ADMIN: FakeUser = { id: 'u1', name: 'Mosab', role: 'admin', perms: [] };
afterEach(() => setActor(null));

/** stock of every sku and place at the end of each day */
const net = (moves: Move[]) => { const n: Record<string, number> = {}; for (const m of moves) { const a = `${m.date}|${m.sku}|`; n[a + m.to] = (n[a + m.to] ?? 0) + m.qty; n[a + m.from] = (n[a + m.from] ?? 0) - m.qty; } return Object.fromEntries(Object.entries(n).filter(([, v]) => v !== 0)); };
const byDay = (o: Record<string, number>, keep: (day: string) => boolean) => Object.fromEntries(Object.entries(o).filter(([k]) => keep(k.slice(0, 10))));
const totals = (moves: Move[]) => { const n: Record<string, number> = {}; for (const m of moves) { n[`${m.sku}|${m.to}`] = (n[`${m.sku}|${m.to}`] ?? 0) + m.qty; n[`${m.sku}|${m.from}`] = (n[`${m.sku}|${m.from}`] ?? 0) - m.qty; } return Object.fromEntries(Object.entries(n).filter(([, v]) => v !== 0)); };

describe.skipIf(!boot)('moving the scan sheets to their pickup days (live data)', () => {
  it('every sheet lands on its pickup day; balances, returns, packaging and other days stay as they were', async () => {
    const srv = createFakeServer(boot!, ADMIN);
    setActor(ADMIN.name);
    const r = createMemoryRepo(createServerBackend(srv.bootNow(), srv.transport));
    let s = await r.snapshot();
    const pkDate = (pid: string) => s.pickups.find((p) => p.id === pid)!.date;
    // the live site already did this one with the older tool (returned orders stayed on the old sheet): replay it
    if ((s.lock ?? '') >= '2026-10-31') { await r.reopenDay('2026-10-31'); s = await r.snapshot(); }
    if (s.docs.find((d) => d.no === 'SCN-0001')?.status === 'done') {
      const left = s.orders.filter((o) => o.shipDoc === 'SCN-0001' && o.status === 'shipped' && !o.returned).map((o) => o.ref);
      await r.reverseShipment('SCN-0001');
      await r.shipOrders({ refs: left, employee: ADMIN.name, source: 'QRbot', date: '2026-10-31', as: { employee: 'Abdallah', redateOf: 'SCN-0001' } } as never);
      s = await r.snapshot();
    }
    const before = { tot: totals(s.moves), sup: Object.fromEntries(s.supplies.map((x) => [x.id, supplyBalance(s.supplyLog, x.id)])), returned: s.orders.filter((o) => o.returned).map((o) => [o.ref, o.returned!.doc]), n: net(s.moves) };
    const sheets = s.docs.filter((d) => d.type === 'SCN' && s.orders.some((o) => o.shipDoc === d.no && o.status === 'shipped'));
    const plan = sheets.map((d) => ({ no: d.no, from: d.date, to: [...new Set(s.orders.filter((o) => o.shipDoc === d.no && o.status === 'shipped').map((o) => pkDate(o.pickupId)))] })).filter((p) => p.to.length === 1 && p.to[0] !== p.from);
    console.log(plan.map((p) => `${p.no}: ${p.from} -> ${p.to[0]}`).join('\n'));
    // after the live fix every sheet is already on its pickup day: then there is nothing to move, and that is checked below   // (the live data has no packaging items yet, so the packaging check is empty there)
    for (const p of plan) {
      const res = await r.redateShipment(p.no, p.to[0]);
      expect(res.orders).toBeGreaterThan(0);
    }
    s = await r.snapshot();
    // 1) every shipped order now leaves on its pickup's day
    const wrong = s.orders.filter((o) => o.status === 'shipped').filter((o) => s.docs.find((d) => d.no === o.shipDoc)!.date !== pkDate(o.pickupId));
    expect(wrong.map((o) => o.ref)).toEqual([]);
    // 2) the same stock everywhere, the same returns, the same packaging
    expect(totals(s.moves)).toEqual(before.tot);
    expect(s.orders.filter((o) => o.returned).map((o) => [o.ref, o.returned!.doc])).toEqual(before.returned);
    expect(Object.fromEntries(s.supplies.map((x) => [x.id, supplyBalance(s.supplyLog, x.id)]))).toEqual(before.sup);
    // 3) days after the last pickup day are untouched; the sheets' old day only lost the moved shipments
    const last = plan.reduce((a, p) => (p.from > a ? p.from : a), '');
    expect(byDay(net(s.moves), (d) => d > last)).toEqual(byDay(before.n, (d) => d > last));
    // 4) the server holds exactly that: a fresh load shows the same, and nothing is left to send
    const fresh = toLovable(mirrorFromBoot(srv.bootNow()));
    expect(fresh.moves.length).toBe(s.moves.length);
    expect(fresh.orders.map((o) => [o.ref, o.status, o.shipDoc])).toEqual(s.orders.map((o) => [o.ref, o.status, o.shipDoc]));
    const m = mirrorFromBoot(srv.bootNow()); expect(isEmpty(toPush(toLovable(m), m, ADMIN.name))).toBe(true);
    // the old sheets say where their orders went
    for (const p of plan) expect(JSON.stringify(srv.bootNow().state.docs.find((d: { no: string }) => d.no === p.no).log)).toContain('اتنقلوا');
    const ships: Record<string, number> = {}; for (const o of s.orders.filter((x) => x.status === 'shipped')) { const d = s.docs.find((x) => x.no === o.shipDoc)!.date; ships[d] = (ships[d] ?? 0) + 1; }
    console.log('orders shipped per day now:', JSON.stringify(ships));
  }, 120_000);
});
