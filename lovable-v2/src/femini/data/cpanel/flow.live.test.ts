// Every state change the item sheet offers, on a copy of the LIVE data, through the copy of the server's rules:
// each one is accepted, moves exactly that quantity from one state to the other, is signed by the signed-in user, and a
// fresh page load shows the same balances. Needs FEMINI_LIVE_BOOT; skipped otherwise.
import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { createMemoryRepo } from '../memory';
import { setActor } from '../repo';
import { createServerBackend } from './backend';
import { createFakeServer, type FakeUser } from './fake-server';
import { mirrorFromBoot, toLovable, type Boot } from './v3';
import { qty } from '@/femini/domain/ledger';
import { cairoToday } from '@/femini/domain/dates';
import { NEXT } from '@/femini/domain/flow';
import { LOCS } from '@/femini/domain/constants';
import type { Loc } from '@/femini/domain/types';

const path = process.env.FEMINI_LIVE_BOOT;
const boot = path && fs.existsSync(path) ? (JSON.parse(fs.readFileSync(path, 'utf8')) as Boot) : null;
const USER: FakeUser = { id: 'u2', name: 'Abdallah', role: 'sup', perms: ['internal', 'scan', 'returns', 'receive', 'count'] };
afterEach(() => setActor(null));

describe.skipIf(!boot)('state changes from the item sheet (live data)', () => {
  it('every next step of every state works and is signed', async () => {
    const srv = createFakeServer(boot!, USER);
    setActor(USER.name);
    const r = createMemoryRepo(createServerBackend(srv.bootNow(), srv.transport));
    let s = await r.snapshot();
    const sku = s.skus.find((k) => qty(s.balances, k.id, 'READY') >= 40)!.id;
    const b = () => s.balances;
    // fill every state first, so each step has pieces to move
    for (const [to, q] of [['DIRTY', 8], ['SCRAP', 4], ['LOST', 4]] as const) {
      await r.postOp({ type: 'CLN', date: cairoToday(), hdr: { from: 'READY', to, reason: 'تيست' }, lines: [{ sku, q }] });
    }
    await r.postOp({ type: 'FSD', date: cairoToday(), hdr: { kind: 'wash' }, lines: [{ sku, q: 4 }] });   // DIRTY → FACTORY
    s = await r.snapshot();
    for (const from of LOCS as Loc[]) {
      for (const step of NEXT[from]) {
        s = await r.snapshot();
        const before = { from: qty(b(), sku, from), to: (LOCS as string[]).includes(step.to) ? qty(b(), sku, step.to as Loc) : null };
        expect(before.from, `${from} has pieces for "${step.label}"`).toBeGreaterThanOrEqual(1);
        const n0 = s.moves.length;
        const res = await r.postOp({ type: step.op, date: cairoToday(), hdr: step.hdr('تيست'), lines: [step.line(sku, 1)] });
        expect(res.pieces, step.label).toBe(1);
        s = await r.snapshot();
        expect(qty(b(), sku, from), `${from} → ${step.to}`).toBe(before.from - 1);
        if (before.to !== null) expect(qty(b(), sku, step.to as Loc), `${from} → ${step.to}`).toBe(before.to + 1);
        const added = s.moves.slice(0, s.moves.length - n0);
        expect(added.every((m) => m.by === USER.name && m.type === step.op && m.from === from && m.to === step.to), `${step.label}: signed and typed`).toBe(true);
      }
    }
    // the server holds exactly that
    const fresh = toLovable(mirrorFromBoot(srv.bootNow()));
    for (const l of LOCS as Loc[]) {
      const sum = fresh.moves.filter((m) => m.sku === sku).reduce((a, m) => a + (m.to === l ? m.qty : 0) - (m.from === l ? m.qty : 0), 0);
      expect(sum, l).toBe(qty(s.balances, sku, l));
    }
    // and it refuses moving more than a state holds
    await expect(r.postOp({ type: 'FSD', date: cairoToday(), hdr: { kind: 'wash' }, lines: [{ sku, q: 9999 }] })).rejects.toThrow();
  }, 120_000);
});
