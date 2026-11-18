/**
 * Archived pickups that are only copies. The same pickup file archived twice leaves the same orders in two archived pickups.
 * A pickup is a duplicate when EVERY one of its orders is also held somewhere that stays: by the live orders, or by an archived
 * pickup that is kept. The oldest archived copy is the one kept (they are looked at oldest first), so one copy of every set of
 * orders always remains: nothing is ever the only holder of an order and deleted. Pure.
 */
export interface ArchivedLike { pickup: { id: string }; orders: { ref: string }[]; at?: string }
export interface DuplicateArchive { id: string; /** the pickups that keep its orders: one or more of these, or the live orders (empty) */ keptIn: string[] }

export function duplicateArchives(archived: ArchivedLike[], liveRefs: ReadonlySet<string>): DuplicateArchive[] {
  const order = [...archived].sort((a, b) => (a.at ?? '').localeCompare(b.at ?? '') || a.pickup.id.localeCompare(b.pickup.id, 'en', { numeric: true }));
  const holder = new Map<string, string>();   // ref → the kept archived pickup that holds it
  const out: DuplicateArchive[] = [];
  for (const a of order) {
    const refs = [...new Set(a.orders.map((o) => o.ref))];
    const covered = refs.length > 0 && refs.every((r) => liveRefs.has(r) || holder.has(r));
    if (covered) { out.push({ id: a.pickup.id, keptIn: [...new Set(refs.map((r) => holder.get(r)).filter((x): x is string => !!x))] }); continue; }
    for (const r of refs) if (!holder.has(r)) holder.set(r, a.pickup.id);
  }
  return out;
}
