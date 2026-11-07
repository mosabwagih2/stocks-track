import type { Balances, Loc, Move, AnyLoc } from './types';
import { LOCS } from './constants';

const INTERNAL = new Set<string>(LOCS);

/** Derive balances from immutable ledger moves. Mirrors the `stock_balances` view in Postgres. */
export function balancesFromMoves(moves: Pick<Move, 'sku' | 'qty' | 'from' | 'to'>[]): Balances {
  const b: Balances = {};
  for (const m of moves) {
    if (INTERNAL.has(m.from)) { const o = (b[m.sku] ??= {}); o[m.from as Loc] = (o[m.from as Loc] ?? 0) - m.qty; }
    if (INTERNAL.has(m.to)) { const o = (b[m.sku] ??= {}); o[m.to as Loc] = (o[m.to as Loc] ?? 0) + m.qty; }
  }
  return b;
}
export const qty = (b: Balances, sku: string, loc: Loc): number => b[sku]?.[loc] ?? 0;
export const totalOwned = (b: Balances, sku: string): number => LOCS.reduce((a, l) => a + qty(b, sku, l), 0);
export const locTotal = (b: Balances, loc: Loc): number => { let t = 0; for (const k in b) t += b[k][loc] ?? 0; return t; };

export type { AnyLoc };
