// The channel's settlement sheet on a copy of the LIVE data, through the copy of the server's rules: saved once, seen after a
// reload, refused the second time, hidden from roles without money, and removable. Needs FEMINI_LIVE_BOOT and FEMINI_SETTLE_FILE.
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import * as XLSX from 'xlsx';
import { createMemoryRepo } from '../memory';
import { setActor } from '../repo';
import { createServerBackend } from './backend';
import { createFakeServer, type FakeUser } from './fake-server';
import { mirrorFromBoot, toLovable, type Boot } from './v3';
import { collectedOf, parseSettlement } from '@/femini/domain/settle';

const bootPath = process.env.FEMINI_LIVE_BOOT; const file = process.env.FEMINI_SETTLE_FILE;
const boot = bootPath && fs.existsSync(bootPath) ? (JSON.parse(fs.readFileSync(bootPath, 'utf8')) as Boot) : null;
const ADMIN: FakeUser = { id: 'u1', name: 'Mosab', role: 'admin', perms: [] };
const PACK: FakeUser = { id: 'u2', name: 'Abdallah', role: 'pack', perms: ['scan', 'returns', 'pickup'] };
afterEach(() => setActor(null));

describe.skipIf(!boot || !file || !fs.existsSync(file!))('settlement sheet on the live data', () => {
  it('collected orders, totals, duplicates, money hidden, delete', async () => {
    const wb = XLSX.read(fs.readFileSync(file!), { type: 'buffer' });
    const settle = parseSettlement(XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: '' }));
    const srv = createFakeServer(boot!, ADMIN);
    setActor(ADMIN.name);
    const r = createMemoryRepo(createServerBackend(srv.bootNow(), srv.transport));
    const res = await r.importSettlement({ settle, source: 'tasweya.xlsx' });
    expect(res).toMatchObject({ id: 'STL-0001', collected: 71, returned: 20, due: 42765 });
    // a fresh page load shows it, and the orders it collected
    const fresh = toLovable(mirrorFromBoot(srv.bootNow()));
    expect(fresh.settles).toHaveLength(1);
    expect(fresh.settles![0].totals).toEqual({ sales: 79168, cod: 72993, due: 42765, channel: 30228 });
    const { collected } = collectedOf(fresh.settles!);
    const shippedPaid = fresh.orders.filter((o) => o.status === 'shipped' && collected.has(o.ref));
    expect(shippedPaid.length).toBe(65);   // 65 collected orders are in the system (6 are from before it; re9000's row is an adjustment)
    // the same sheet again is refused, nothing is written
    const rev = srv.rev;
    await expect(r.importSettlement({ settle, source: 'again.xlsx' })).rejects.toThrow(/اترفع قبل كده/);
    expect(srv.rev).toBe(rev);
    // a packer may upload but does not see the amounts
    const packSrv = createFakeServer(srv.bootNow(), PACK);
    expect(packSrv.pull(0).coll.settles).toEqual([]);
    // remove it (a wrong upload)
    await r.deleteSettlement('STL-0001');
    expect(toLovable(mirrorFromBoot(srv.bootNow())).settles).toHaveLength(0);
  }, 120_000);
});
