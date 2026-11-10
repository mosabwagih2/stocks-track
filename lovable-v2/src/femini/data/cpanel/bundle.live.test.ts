// «PAN6 Bundle» (the legacy model, code with a space) gets the size L that the pickup uses, on a copy of the LIVE data and through
// the copy of the server rules. Needs FEMINI_LIVE_BOOT (a boot.json saved from the running site); skipped otherwise.
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createMemoryRepo } from '../memory';
import { setActor } from '../repo';
import { createServerBackend } from './backend';
import { createFakeServer, type FakeUser } from './fake-server';
import { mirrorFromBoot, toLovable, type Boot } from './v3';
import { cairoToday } from '@/femini/domain/dates';

const path = process.env.FEMINI_LIVE_BOOT;
const boot = path && fs.existsSync(path) ? (JSON.parse(fs.readFileSync(path, 'utf8')) as Boot) : null;
const has = !!boot?.state && JSON.stringify(boot.state).includes('PAN6 Bundle');
const ADMIN: FakeUser = { id: 'u1', name: 'Mosab', role: 'admin', perms: [] };
afterEach(() => setActor(null));

describe.skipIf(!has)('PAN6 Bundle on the live data', () => {
  it('a pickup line FC-PAN6-Bundle size L waits, then links when L is added to PAN6 Bundle; stock can be received on it', async () => {
    const srv = createFakeServer(boot!, ADMIN); setActor(ADMIN.name);
    const r = createMemoryRepo(createServerBackend(srv.bootNow(), srv.transport));
    const s0 = await r.snapshot();
    const old = s0.skus.find((k) => k.model === 'PAN6 Bundle')!;
    expect(old.id).toBe('PAN6_Bundle-X1-FREE');
    // the pickup's line is for size L, which the model lacks: it waits as an unlinked line
    const ref = 'zbundle1';
    await r.importPickup({ label: 'ب', date: cairoToday(), channel: 'VENDOOR', source: 'x', orders: [{ ref, waybill: '9zb1', type: 'new', gov: '', total: 500, lines: [], unmapped: [['FC-PAN6-Bundle', 'L', old.color, 1]] }] });
    expect((await r.snapshot()).orders.find((o) => o.ref === ref)?.lines).toEqual([]);
    // L is added to the existing model: the item code is server-safe (no space), and the waiting order links by itself
    const res = await r.catalogEditModel({ code: 'PAN6 Bundle', name: '', add: [{ color: old.color, size: 'L' }], remove: [] });
    expect(res.added).toBe(1);
    const s1 = await r.snapshot();
    const l = s1.skus.find((k) => k.model === 'PAN6 Bundle' && k.size === 'L')!;
    expect(l.id).toBe('PAN6_Bundle-X1-L');
    expect(s1.orders.find((o) => o.ref === ref)?.lines).toEqual([l.id]);
    // stock is received on it through the server rules, and a fresh load shows the same
    await r.postOp({ type: 'RCV', date: cairoToday(), hdr: { ref: 'ZB1', declared: 4 }, lines: [{ sku: l.id, q: 4 }], photo: new File(['x'], 'p.jpg', { type: 'image/jpeg' }) });
    const s2 = await r.snapshot();
    expect(s2.balances[l.id]?.READY).toBe(4);
    const fresh = toLovable(mirrorFromBoot(srv.bootNow()));
    expect(fresh.cat.skus.some((k) => k.id === l.id && k.model === 'PAN6 Bundle')).toBe(true);
    expect(s2.skus.filter((k) => k.model === 'PAN6 Bundle')).toHaveLength(2);   // still one model, with FREE and L
  });
});
