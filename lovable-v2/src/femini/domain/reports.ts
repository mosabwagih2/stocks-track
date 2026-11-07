import { balancesFromMoves, qty } from './ledger';
import { LOCS } from './constants';
import { allocate } from './orders';
import { cairoDay } from './dates';
import type { Snapshot, Loc } from './types';

export function backupDue(last: string | null, now = Date.now()): boolean {
  return !last || !Number.isFinite(Date.parse(last)) || now - Date.parse(last) > 7 * 864e5;
}

/** Current recorded unit costs, not historical acquisition costs or realized profit. */
export function financialReport(s: Snapshot) {
  const balances = balancesFromMoves(s.moves);
  const catalog = new Map([...s.skus, ...s.archivedSkus].map((k) => [k.id, k]));
  const models = new Map<string, { code: string; name: string; units: Record<Loc, number>; cost: number | null; price: number | null }>();
  const unknown: string[] = [];
  for (const id of Object.keys(balances)) {
    const sku = catalog.get(id);
    if (!sku) { unknown.push(id); continue; }
    const c = s.costs[sku.model];
    const row = models.get(sku.model) ?? { code: sku.model, name: s.models.find((m) => m.code === sku.model)?.name ?? sku.model, units: { READY: 0, DIRTY: 0, FACTORY: 0, SCRAP: 0, LOST: 0 }, cost: c && Number.isFinite(c.cost) && c.cost > 0 ? c.cost : null, price: c && Number.isFinite(c.price) && c.price > 0 ? c.price : null };
    for (const loc of LOCS) row.units[loc] += qty(balances, id, loc);
    models.set(sku.model, row);
  }
  const rows = [...models.values()];
  const state = (loc: Loc) => ({ units: rows.reduce((a, r) => a + r.units[loc], 0), known: rows.reduce((a, r) => a + (r.cost === null ? 0 : r.units[loc] * r.cost), 0), missing: rows.filter((r) => r.units[loc] !== 0 && r.cost === null).length });
  return { rows, unknown, negative: Object.keys(balances).filter((id) => LOCS.some((l) => qty(balances, id, l) < 0)), ready: state('READY'), dirty: state('DIRTY'), factory: state('FACTORY'), scrap: state('SCRAP'), lost: state('LOST'), missing: rows.filter((r) => Object.values(r.units).some((n) => n !== 0) && r.cost === null) };
}

export function dayReport(s: Snapshot, date: string) {
  const moves = s.moves.filter((m) => m.date === date);
  const balances = balancesFromMoves(s.moves.filter((m) => m.date <= date));
  const pickups = s.pickups.filter((p) => p.date <= date);
  // Only reconstruct statuses with evidence available by end of the selected day.
  const orders = s.orders.filter((o) => pickups.some((p) => p.id === o.pickupId)).map((o) => ({ ...o, status: o.cancel && cairoDay(o.cancel.at) <= date ? 'cancelled' as const : o.shippedAt && cairoDay(o.shippedAt) <= date ? 'shipped' as const : 'open' as const }));
  const requested = orders.filter((o) => s.pickups.some((p) => p.id === o.pickupId && p.date === date));
  const open = orders.filter((o) => o.status === 'open');
  const blocked = allocate(open, pickups, balances).blocked.size;
  const sum = (predicate: (m: (typeof moves)[number]) => boolean) => moves.filter(predicate).reduce((a, m) => a + m.qty, 0);
  const shipped = sum((m) => m.to === 'EXT_CH') - sum((m) => m.from === 'EXT_CH' && m.type === 'SCN');
  const summary = { requested: requested.reduce((a, o) => a + o.lines.length, 0), shipped, returned: sum((m) => m.type === 'RTN' && m.from.startsWith('EXT_')), received: sum((m) => m.type === 'RCV' && m.to === 'READY'), ready: Object.values(balances).reduce((a, b) => a + (b.READY ?? 0), 0), damaged: Object.values(balances).reduce((a, b) => a + (b.SCRAP ?? 0) + (b.LOST ?? 0), 0) };
  const team = new Map<string, number>();
  for (const m of moves) if (m.to === 'EXT_CH' || (m.from === 'EXT_CH' && m.type === 'SCN')) team.set(m.by, (team.get(m.by) ?? 0) + (m.to === 'EXT_CH' ? m.qty : -m.qty));
  return { date, summary, requestedOrders: requested.length, open: open.length, blocked, team: [...team], moves, balances };
}