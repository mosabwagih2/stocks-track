/**
 * The 80/20 view of the demand: models ranked by pieces requested, each with the running share and a class from the
 * share of the demand BEFORE it (A up to 80%, B up to 95%, C the rest), so the first model is always A. Pure.
 *
 * The class totals are counted over EVERY model, not only the ones a page lists, so the three shares add up to the
 * whole demand.
 */
export type ParetoClass = 'A' | 'B' | 'C';
export interface ParetoRow { m: string; v: number; /** running share, % */ cum: number; cls: ParetoClass }
export function paretoRows(pull: Record<string, number>) {
  const sorted = Object.entries(pull).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = sorted.reduce((a, x) => a + x[1], 0);
  let cum = 0;
  const rows: ParetoRow[] = sorted.map(([m, v]) => {
    const before = total ? cum / total : 0; cum += v;
    return { m, v, cum: total ? Math.round((cum / total) * 100) : 0, cls: before < 0.8 ? 'A' : before < 0.95 ? 'B' : 'C' };
  });
  const classes = (['A', 'B', 'C'] as const).map((k) => { const xs = rows.filter((r) => r.cls === k); return { k, models: xs.length, pieces: xs.reduce((a, r) => a + r.v, 0) }; });
  return { rows, total, classes };
}
