import type { Balances, Sku } from './types';
import { qty } from './ledger';

export interface Cell { ready: number; demand: number; velocity: number; cover: number | null; level: '' | 'warn' | 'crit'; surplus: boolean }

export function cellInfo(sku: Sku, b: Balances, demand: Record<string, number>, vel: Record<string, number>, velOK: boolean, coverDays: number): Cell {
  const ready = qty(b, sku.id, 'READY'); const d = demand[sku.id] ?? 0; const v = vel[sku.id] ?? 0;
  const threshold = velOK ? Math.ceil(v * coverDays) : sku.minAlert;
  let level: Cell['level'] = '';
  if (d > ready || (velOK && v > 0 && ready === 0)) level = 'crit';
  else if (threshold > 0 && ready - d < threshold) level = 'warn';
  const cover = v > 0 ? ready / v : null;
  return { ready, demand: d, velocity: v, cover, level, surplus: velOK && cover !== null && cover > 60 };
}

/**
 * "Lasts how many days" for a cell: ready ÷ withdrawal rate (the same `cover` as cellInfo), as a short label.
 * No withdrawals in the window → no label; out of stock while it is being withdrawn → «خلص»; over 60 days → «+60 يوم».
 * `estimated` (fewer than 3 pickup days) puts a ~ in front. Pure.
 */
export function coverLabel(c: Pick<Cell, 'ready' | 'velocity'>, estimated = false): string {
  if (!(c.velocity > 0)) return '';
  if (c.ready <= 0) return 'خلص';
  const days = c.ready / c.velocity;
  const t = days < 1 ? 'أقل من يوم' : days > 60 ? '+60 يوم' : ((n) => (n === 1 ? 'يوم' : n === 2 ? 'يومين' : n <= 10 ? `${n} أيام` : `${n} يوم`))(Math.floor(days));
  return (estimated ? '~' : '') + t;
}
