import { describe, expect, it } from 'vitest';
import { nextPickupLabel, sheetKey, usedPickupSheet } from './sheetNames';

const p = (label: string, date: string, source: string) => ({ label, date, source });

describe('a pickup sheet is its file name', () => {
  it('names match without caring about case, spaces or composition', () => {
    expect(sheetKey('  بيك اب  FEMINI G 29-10-2026.XLSX ')).toBe(sheetKey('بيك اب FEMINI G 29-10-2026.xlsx'));
    expect(sheetKey('é.xlsx')).toBe(sheetKey('é.xlsx')); expect(sheetKey('a.xlsx')).not.toBe(sheetKey('b.xlsx'));
  });
  it('finds the live pickup, or the archived one, that the same sheet already made', () => {
    const pickups = [p('بيك أب 3', '2026-11-03', 'بيك اب FEMINI G 3-11-2026.xlsx')];
    const archived = [{ pickup: p('بيك أب 7', '2026-10-29', 'بيك اب FEMINI G 29-10-2026.xlsx') }];
    expect(usedPickupSheet('بيك اب femini g 3-11-2026.XLSX', pickups, archived)).toEqual({ label: 'بيك أب 3', date: '2026-11-03', archived: false });
    expect(usedPickupSheet('بيك اب FEMINI G 29-10-2026.xlsx', pickups, archived)).toEqual({ label: 'بيك أب 7', date: '2026-10-29', archived: true });
  });
  it('a new name, an empty name, or a pickup with no recorded file is never "used"', () => {
    expect(usedPickupSheet('جديد.xlsx', [p('بيك أب 1', '2026-11-01', '')], [])).toBeNull();
    expect(usedPickupSheet('', [p('بيك أب 1', '2026-11-01', '')], [])).toBeNull();
    expect(usedPickupSheet('x.xlsx', [p('بيك أب 1', '2026-11-01', 'x.xlsx (1).xlsx')], [])).toBeNull();
  });
  it('the next label counts the archived pickups too, so a number is never used twice', () => {
    expect(nextPickupLabel([p('بيك أب 2', '', ''), p('بيك أب 5', '', '')], [{ pickup: p('بيك أب 31', '', '') }])).toBe('بيك أب 32');
    expect(nextPickupLabel([], [])).toBe('بيك أب 1'); expect(nextPickupLabel([p('بدون رقم', '', '')])).toBe('بيك أب 1');
  });
});
