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
