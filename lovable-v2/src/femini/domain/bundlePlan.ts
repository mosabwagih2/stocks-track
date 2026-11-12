/**
 * Bundles share pieces: the same BR1 feeds the 3-piece bundle and the 5-piece one. The orders of each bundle on its own cannot be
 * added up. Here the pieces of a size are shared out: a number of orders per bundle, what is left, and what each can still fill.
 */
import { compCapacity, normColor, type Bundle, type BundleVariant, type Stockroom } from './bundles';

/** one thing a customer can buy: a bundle, or one color combination of it */
export interface Product { key: string; bundle: Bundle; variant: BundleVariant; title: string }
export const productsOf = (bundles: Bundle[]): Product[] =>
  bundles.filter((b) => !b.unknown).flatMap((b) => b.variants.map((v, i): Product => ({ key: `${b.id}#${i}`, bundle: b, variant: v, title: b.variants.length > 1 && v.label ? `${b.title} · ${v.label}` : b.title })));

/** the pieces of one size: `${model}|${color}` → how many */
export type Supply = Map<string, number>;
const key = (model: string, color: string) => `${model}|${normColor(color)}`;

export function supplyOf(room: Stockroom, size: string, models: Iterable<string>): Supply {
  const s: Supply = new Map();
  for (const m of models) for (const c of room.colorsOf(m)) { const h = room.have(m, c, size); if (h != null) s.set(key(m, c), Math.max(0, h)); }
  return s;
}
const roomOf = (supply: Supply, base: Stockroom): Stockroom => ({ colorsOf: base.colorsOf, have: (m, c) => supply.get(key(m, c)) ?? null });

/** the most orders of a product the supply can fill (the others' pieces already taken out of it) */
export function maxOf(p: Product, size: string, supply: Supply, base: Stockroom): number {
  const room = roomOf(supply, base);
  return p.variant.comps.length ? Math.min(...p.variant.comps.map((c) => compCapacity(c, size, room).max)) : 0;
}

/** takes `n` orders of a product out of the supply; null when the pieces are not enough */
export function take(supply: Supply, p: Product, size: string, n: number, base: Stockroom): Supply | null {
  if (n <= 0) return supply;
  const s: Supply = new Map(supply);
  for (const c of p.variant.comps) {
    const r = compCapacity(c, size, roomOf(s, base));
    if (r.max < n) return null;
    const cap = c.any ? Infinity : Math.ceil(c.qty / Math.max(1, r.colors.length)) * n;   // a color gives its share, the fullest colors first
    let need = c.qty * n;
    const order = [...r.colors].sort((a, b) => (s.get(key(c.model, b)) ?? 0) - (s.get(key(c.model, a)) ?? 0));
    for (const col of order) { const k = key(c.model, col); const t = Math.min(need, cap, s.get(k) ?? 0); s.set(k, (s.get(k) ?? 0) - t); need -= t; }
    if (need > 0) return null;
  }
  return s;
}

export interface PlanRow { key: string; n: number }
export interface PlanResult { rows: { key: string; n: number; ok: boolean; /** the most it could be, with the other rows kept */ max: number }[]; left: Supply; total: number }

/** the rows in order take their pieces; a row that does not fit takes nothing and is marked */
export function plan(products: Product[], rows: PlanRow[], size: string, base: Stockroom, supply0: Supply): PlanResult {
  const byKey = new Map(products.map((p) => [p.key, p]));
  const run = (skip: number) => { let s = supply0; const ok: boolean[] = []; rows.forEach((r, i) => { if (i === skip) { ok.push(true); return; } const p = byKey.get(r.key); const t = p ? take(s, p, size, r.n, base) : null; if (t) { s = t; ok.push(true); } else ok.push(false); }); return { s, ok }; };
  const all = run(-1);
  const out = rows.map((r, i) => { const p = byKey.get(r.key); return { key: r.key, n: r.n, ok: all.ok[i], max: p ? maxOf(p, size, run(i).s, base) : 0 }; });
  return { rows: out, left: all.s, total: out.reduce((a, r) => a + (r.ok ? r.n : 0), 0) };
}

/** the same number of orders of each product: the most that fits together */
export function balanced(products: Product[], keys: string[], size: string, base: Stockroom, supply0: Supply): number {
  const ps = keys.map((k) => products.find((p) => p.key === k)).filter((p): p is Product => !!p);
  if (!ps.length) return 0;
  const fits = (t: number) => { let s: Supply | null = supply0; for (const p of ps) { s = take(s, p, size, t, base); if (!s) return false; } return true; };
  let lo = 0; let hi = Math.max(...ps.map((p) => maxOf(p, size, supply0, base)));
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (fits(mid)) lo = mid; else hi = mid - 1; }
  return lo;
}

/** which bundles draw on the same pieces: bundle id → the other bundles sharing at least one (model, color) with it */
export function sharing(bundles: Bundle[], room: Stockroom, size: string): Map<string, Bundle[]> {
  const users = new Map<string, Set<string>>(); const keys = new Map<string, Set<string>>();
  for (const b of bundles) {
    if (b.unknown) continue;
    for (const v of b.variants) for (const c of v.comps) for (const col of compCapacity(c, size, room).colors) {
      const k = key(c.model, col); (users.get(k) ?? users.set(k, new Set()).get(k)!).add(b.id); (keys.get(b.id) ?? keys.set(b.id, new Set()).get(b.id)!).add(k);
    }
  }
  const byId = new Map(bundles.map((b) => [b.id, b]));
  const out = new Map<string, Bundle[]>();
  for (const b of bundles) { const others = new Set<string>(); for (const k of keys.get(b.id) ?? []) for (const id of users.get(k) ?? []) if (id !== b.id) others.add(id); out.set(b.id, [...others].map((id) => byId.get(id)!)); }
  return out;
}
