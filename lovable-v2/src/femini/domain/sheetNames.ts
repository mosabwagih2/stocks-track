/**
 * A pickup sheet is identified by its file name: the same sheet cannot be uploaded twice, whether the pickup it made is still
 * there or was archived. (The orders alone cannot tell: once a pickup is archived its orders leave the live orders, and the same file
 * uploaded again would make them again.) Names are compared without caring about case, extra spaces or how the letters were
 * composed. Pure.
 */
export const sheetKey = (name: string): string => name.trim().normalize('NFC').toLowerCase().replace(/\s+/g, ' ');

export interface PickupLike { label: string; date: string; source: string }
export interface UsedSheet { label: string; date: string; archived: boolean }

/** the pickup (live or archived) that was made from a sheet of this name, or null */
export function usedPickupSheet(name: string, pickups: PickupLike[], archived: { pickup: PickupLike }[] = []): UsedSheet | null {
  const k = sheetKey(name); if (!k) return null;
  const live = pickups.find((p) => sheetKey(p.source ?? '') === k); if (live) return { label: live.label, date: live.date, archived: false };
  const old = archived.find((a) => sheetKey(a.pickup.source ?? '') === k); return old ? { label: old.pickup.label, date: old.pickup.date, archived: true } : null;
}

/** the next pickup label: one more than the highest number any pickup has had, live or archived (counting the live ones only repeated numbers) */
export function nextPickupLabel(pickups: { label: string }[], archived: { pickup: { label: string } }[] = []): string {
  const n = [...pickups, ...archived.map((a) => a.pickup)].reduce((m, p) => Math.max(m, Number(/(\d+)\s*$/.exec(p.label)?.[1]) || 0), 0);
  return `بيك أب ${n + 1}`;
}
