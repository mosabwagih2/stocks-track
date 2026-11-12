/**
 * Bundles (باندلز): what the store sells as one product made of several pieces, and how many orders of each the stock can fill.
 * A bundle order is a list of pieces, so what limits it is the scarcest piece: no bundle is its own stock.
 */
export interface BundleComp {
  model: string;
  qty: number;
  /** the colors the pieces come from, one of each at most when there are enough of them; null = all the model's colors */
  colors?: string[] | null;
  /** colors left out of "all" */
  except?: string[];
  /** no color is named: any pieces of the model will do */
  any?: boolean;
}
export interface BundleVariant { label: string; comps: BundleComp[] }
export interface Bundle {
  id: string; title: string; type: string; price: number; was: number; url: string; available: boolean;
  sizes: string[]; variants: BundleVariant[];
  /** set when the store does not say what is inside; the bundle is listed but not counted */
  unknown?: string;
}

/** colors compare without the spelling of the hamza and the final ى */
export const normColor = (c: string): string => {
  const x = c.replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').trim().replace(/^ال(?=\S)/, '');   // «الابيض» = «ابيض»
  return x === 'اورنج' ? 'برتقالي' : x;
};

/** the pieces of the stock the bundle asks for: how many of this model, in this size, per color */
export interface Stockroom {
  /** the colors the catalog has for the model */
  colorsOf: (model: string) => string[];
  /** the pieces available of (model, color, size), the catalog's own color spelling; null when there is no such item */
  have: (model: string, color: string, size: string) => number | null;
}

export interface CompResult { comp: BundleComp; colors: string[]; have: Record<string, number>; max: number; missing: string[] }

/** the most bundles of a component: each bundle takes `qty` pieces, a color giving at most ceil(qty / colors) of them */
export function compCapacity(comp: BundleComp, size: string, room: Stockroom): CompResult {
  const all = room.colorsOf(comp.model);
  const wanted = comp.any || comp.colors == null ? all : comp.colors.map(normColor).map((n) => all.find((a) => normColor(a) === n) ?? n);
  const except = new Set((comp.except ?? []).map(normColor));
  const colors = wanted.filter((c) => !except.has(normColor(c)));
  const have: Record<string, number> = {}; const missing: string[] = [];
  for (const c of colors) { const h = room.have(comp.model, c, size); if (h == null) { missing.push(c); have[c] = 0; } else have[c] = Math.max(0, h); }
  if (!colors.length) return { comp, colors, have, max: 0, missing };
  const cap = comp.any ? comp.qty : Math.ceil(comp.qty / colors.length);   // no color named: any piece will do
  const sum = (n: number) => colors.reduce((a, c) => a + Math.min(have[c], cap * n), 0);
  let lo = 0; let hi = Math.floor(colors.reduce((a, c) => a + have[c], 0) / comp.qty);
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (sum(mid) >= comp.qty * mid) lo = mid; else hi = mid - 1; }
  return { comp, colors, have, max: lo, missing };
}

export interface VariantResult { variant: BundleVariant; max: number; comps: CompResult[]; limiting: CompResult | null }
export function variantCapacity(v: BundleVariant, size: string, room: Stockroom): VariantResult {
  const comps = v.comps.map((c) => compCapacity(c, size, room));
  const limiting = comps.reduce<CompResult | null>((m, c) => (!m || c.max < m.max ? c : m), null);
  return { variant: v, max: limiting ? limiting.max : 0, comps, limiting };
}

export interface SizeResult { size: string; max: number; best: VariantResult | null; variants: VariantResult[] }
/** per size: the orders the stock can fill (a bundle with several color combinations: the best combination) */
export function bundleBySize(b: Bundle, room: Stockroom): SizeResult[] {
  return b.sizes.map((size) => {
    const variants = b.variants.map((v) => variantCapacity(v, size, room));
    const best = variants.reduce<VariantResult | null>((m, v) => (!m || v.max > m.max ? v : m), null);
    return { size, max: best?.max ?? 0, best, variants };
  });
}
export const bundleTotal = (rows: SizeResult[]) => rows.reduce((a, r) => a + r.max, 0);
/** "5× BR2 + 5× PAN3 …" */
export const bundleLine = (v: BundleVariant) => v.comps.map((c) => `${c.qty}× ${c.model}`).join(' + ');
export const bundleModels = (b: Bundle): string[] => [...new Set(b.variants.flatMap((v) => v.comps.map((c) => c.model)))];
