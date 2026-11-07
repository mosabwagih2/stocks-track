// Checks the bridge against a copy of the LIVE server data (window.FEM_BOOT saved from the running site).
// The data is never in the repository: point FEMINI_LIVE_BOOT at a boot.json to run it, otherwise it is skipped.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { isEmpty, mirrorFromBoot, toLovable, toPush, type Boot } from './v3';
import { balancesFromMoves } from '@/femini/domain/ledger';

const path = process.env.FEMINI_LIVE_BOOT;
const boot = path && fs.existsSync(path) ? (JSON.parse(fs.readFileSync(path, 'utf8')) as Boot) : null;

describe.skipIf(!boot)('live server data', () => {
  it('loads every order, move, document and pickup', () => {
    const m = mirrorFromBoot(boot!); const S = toLovable(m); const s3 = boot!.state;
    expect(S.moves.length).toBe(s3.moves.length);
    expect(S.orders.length).toBe(s3.orders.length);
    expect(S.pickups.length).toBe(s3.pickups.length);
    expect(S.docs.length + S.drafts!.length).toBeLessThanOrEqual(s3.docs.length);
    expect(S.lock).toBe(s3.lock);
    expect(S.mid).toBe(s3.mid);
  });
  it('stock balances are exactly the server ledger', () => {
    const m = mirrorFromBoot(boot!); const S = toLovable(m);
    const server = balancesFromMoves(boot!.state.moves.map((x: { sku: string; q: number; from: string; to: string }) => ({ sku: x.sku, qty: x.q, from: x.from as never, to: x.to as never })));
    expect(balancesFromMoves(S.moves)).toEqual(server);
  });
  it('loading and saving without any change sends nothing to the server', () => {
    const m = mirrorFromBoot(boot!); const S = toLovable(m);
    const p = toPush(S, m, boot!.user?.name ?? 'x');
    if (!isEmpty(p)) console.log(JSON.stringify({ moves: p.moves.length, coll: Object.fromEntries(Object.entries(p.coll).map(([k, v]) => [k, { up: v!.up.length, gone: v!.gone, first: JSON.stringify(v!.up[0]).slice(0, 600) }])), meta: Object.keys(p.meta) }, null, 1));
    expect(isEmpty(p)).toBe(true);
  });
});
