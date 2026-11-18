import { describe, expect, it } from 'vitest';
import { acceptsFile } from './fileAccept';

describe('a dropped file is checked the way a file input would filter it', () => {
  it('extensions, in any letter case', () => {
    expect(acceptsFile({ name: 'مرتجعات.xlsx' }, '.xlsx,.xls')).toBe(true);
    expect(acceptsFile({ name: 'A.XLS' }, '.xlsx,.xls')).toBe(true);
    expect(acceptsFile({ name: 'a.csv' }, '.xlsx,.xls')).toBe(false);
    expect(acceptsFile({ name: 'a.xlsx.exe' }, '.xlsx')).toBe(false);
  });
  it('a family like image/* and an exact type', () => {
    expect(acceptsFile({ name: 'p.jpg', type: 'image/jpeg' }, 'image/*')).toBe(true);
    expect(acceptsFile({ name: 'p.pdf', type: 'application/pdf' }, 'image/*')).toBe(false);
    expect(acceptsFile({ name: 'b.json', type: 'application/json' }, '.json,application/json')).toBe(true);
  });
  it('an empty list accepts anything', () => { expect(acceptsFile({ name: 'x' }, '')).toBe(true); });
});
