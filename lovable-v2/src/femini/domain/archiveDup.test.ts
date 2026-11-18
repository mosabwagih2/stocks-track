import { describe, expect, it } from 'vitest';
import { duplicateArchives } from './archiveDup';

const a = (id: string, at: string, refs: string[]) => ({ pickup: { id }, at, orders: refs.map((ref) => ({ ref })) });
const none = new Set<string>();

describe('archived pickups that are only copies', () => {
  it('keeps the oldest copy and marks the later ones of the same orders', () => {
    const list = [a('P19', '2026-11-17T10:00', ['x1', 'x2']), a('P7', '2026-11-15T10:00', ['x1', 'x2']), a('P20', '2026-11-18T10:00', ['x2', 'x1'])];
    expect(duplicateArchives(list, none)).toEqual([{ id: 'P19', keptIn: ['P7'] }, { id: 'P20', keptIn: ['P7'] }]);   // P7 is the oldest: it stays
  });
  it('a pickup with even one order nobody else holds is never a duplicate', () => {
    const list = [a('P1', '2026-11-01', ['x1', 'x2']), a('P2', '2026-11-02', ['x1', 'x2', 'x3'])];
    expect(duplicateArchives(list, none)).toEqual([]);
  });
  it('orders held by several kept pickups together still count as covered', () => {
    const list = [a('P1', '2026-11-01', ['x1']), a('P2', '2026-11-02', ['x2']), a('P3', '2026-11-03', ['x1', 'x2'])];
    expect(duplicateArchives(list, none)).toEqual([{ id: 'P3', keptIn: ['P1', 'P2'] }]);
  });
  it('orders that are live (not archived) cover an archived copy too, and nothing is kept for it', () => {
    expect(duplicateArchives([a('P1', '2026-11-01', ['x1', 'x2'])], new Set(['x1', 'x2']))).toEqual([{ id: 'P1', keptIn: [] }]);
  });
  it('one copy of every set always stays, and an empty archive or an empty pickup is left alone', () => {
    const list = [a('A', '1', ['x']), a('B', '2', ['x']), a('C', '3', ['x'])];
    const del = duplicateArchives(list, none).map((d) => d.id); expect(del).toEqual(['B', 'C']); expect(list.length - del.length).toBe(1);
    expect(duplicateArchives([], none)).toEqual([]); expect(duplicateArchives([a('E', '1', [])], none)).toEqual([]);
  });
});
