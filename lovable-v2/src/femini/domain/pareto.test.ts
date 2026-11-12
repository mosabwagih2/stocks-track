import { describe, expect, it } from 'vitest';
import { paretoRows } from './pareto';

describe('80/20 of the demand', () => {
  it('ranks the models, gives each its running share and its class from the share before it', () => {
    const { rows, total } = paretoRows({ SH2: 10, BR2: 50, PAN3: 30, D3: 5, X1: 5, Z0: 0 });
    expect(total).toBe(100);
    expect(rows.map((r) => [r.m, r.v, r.cum, r.cls])).toEqual([
      ['BR2', 50, 50, 'A'], ['PAN3', 30, 80, 'A'], ['SH2', 10, 90, 'B'], ['D3', 5, 95, 'B'], ['X1', 5, 100, 'C'],   // a model with no demand is left out
    ]);
  });
  it('class totals count every model, so the three shares add up to the whole demand even when a page lists only the top', () => {
    const pull: Record<string, number> = {}; for (let i = 0; i < 40; i++) pull[`M${String(i).padStart(2, '0')}`] = 40 - i;
    const { rows, total, classes } = paretoRows(pull);
    expect(rows).toHaveLength(40);
    expect(classes.reduce((a, c) => a + c.pieces, 0)).toBe(total);
    expect(classes.reduce((a, c) => a + c.models, 0)).toBe(40);
    expect(classes[2].models).toBeGreaterThan(0);   // the tail beyond the top 20 is class C, and it is counted
  });
  it('no demand gives no rows and empty classes, never a division by zero', () => {
    const r = paretoRows({});
    expect(r.rows).toEqual([]); expect(r.total).toBe(0); expect(r.classes.map((c) => c.models)).toEqual([0, 0, 0]);
  });
});
