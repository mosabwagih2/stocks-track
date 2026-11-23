/**
 * «سعر التوريد»: the one price per model. Kept in the same stored shape as before (`costs[model] = { cost, price }`, the
 * server and the backups know it): saving writes the same number into both, and reading takes `cost`, or `price` when a
 * model only ever had a sale price. 0 = no price recorded. Pure.
 */
export type StoredPrice = { cost?: number; price?: number } | null | undefined;
const pos = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : 0);
export function supplyPrice(c: StoredPrice): number { return pos(c?.cost) || pos(c?.price); }
/** models whose two old numbers differ (both set): the owner should pick one, since only one is used now */
export function priceConflicts(costs: Record<string, StoredPrice> | undefined): { model: string; cost: number; price: number }[] {
  return Object.entries(costs ?? {}).filter(([, c]) => pos(c?.cost) && pos(c?.price) && pos(c?.cost) !== pos(c?.price))
    .map(([model, c]) => ({ model, cost: pos(c?.cost), price: pos(c?.price) }));
}
