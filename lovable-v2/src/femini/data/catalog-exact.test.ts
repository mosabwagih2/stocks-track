import { describe, expect, it } from 'vitest';
import { createMemoryRepo } from './memory';
import { itemMapper } from '../domain/pickup';
import { lineBase } from '../domain/constants';
import { EXACT_CODE, modelCodeOf, validateNewModel } from '../components/catalog-validation';

describe('a model linked from a pickup keeps the code exactly as the pickup writes it', () => {
  it('saves FC-PAN6-Bundle as it is, and the pickup then matches it', async () => {
    const r = createMemoryRepo();
    const made = await r.catalogNewModel({ code: 'FC-PAN6-Bundle', exact: true, name: 'بانتي', colors: ['باندل خمس قطع'], sizes: ['L', 'XL'], minAlert: 0 });
    expect(made).toEqual({ model: 'FC-PAN6-Bundle', skus: 2 });
    const s = await r.snapshot();
    const mine = s.skus.filter((k) => k.model === 'FC-PAN6-Bundle');
    expect(mine.map((k) => k.id).sort()).toEqual(mine.map((k) => `FC-PAN6-Bundle-${k.id.split('-').at(-2)}-${k.size}`).sort());   // model-colourcode-size
    expect(mine.every((k) => k.id.startsWith('FC-PAN6-Bundle-') && k.id.length <= 40)).toBe(true);
    expect(s.models.find((m) => m.code === 'FC-PAN6-Bundle')?.name).toBe('بانتي');
    const hit = itemMapper(s.skus)('FC-PAN6-Bundle', 'L', 'باندل خمس قطع');
    expect(hit.model).toBe('FC-PAN6-Bundle'); expect(hit.id).toBe(mine.find((k) => k.size === 'L')?.id);
  });
  it('is checked again in the repository: same code in another case, a code that does not fit, an id past 40 characters', async () => {
    const r = createMemoryRepo();
    const base = { name: 'بانتي', colors: ['احمر'], sizes: ['M'], minAlert: 0, exact: true };
    await r.catalogNewModel({ ...base, code: 'FC-PAN7' });
    await expect(r.catalogNewModel({ ...base, code: 'fc-pan7' })).rejects.toThrow(/موجود/);
    await expect(r.catalogNewModel({ ...base, code: 'FC PAN8' })).rejects.toThrow(/حرف إنجليزي/);
    await expect(r.catalogNewModel({ ...base, code: '9FC' })).rejects.toThrow();
    await expect(r.catalogNewModel({ ...base, code: 'A'.repeat(25) })).rejects.toThrow();
    await expect(r.catalogNewModel({ ...base, code: 'FC-' + 'B'.repeat(21), sizes: ['EXTRALARGE12'] })).rejects.toThrow(/40/);
  });
  it('typed by hand it is still normalised, as before', async () => {
    const r = createMemoryRepo();
    const made = await r.catalogNewModel({ code: 'pa-3', name: 'بانتي', colors: ['احمر'], sizes: ['M'], minAlert: 0 });
    expect(made.model).toBe('PA3');
    expect(modelCodeOf('pa-3', false)).toBe('PA3'); expect(modelCodeOf(' FC-PAN6-Bundle ', true)).toBe('FC-PAN6-Bundle');
    expect(validateNewModel({ code: 'FC-PAN6-Bundle', name: 'x', min: '', colors: ['a'], sizes: ['M'] }, false, true)).toEqual({});
    expect(validateNewModel({ code: 'FC-PAN6-Bundle', name: 'x', min: '', colors: ['a'], sizes: ['M'] }, false, false).code).toBeTruthy();   // by hand it is still capped at 10 letters and digits
    expect(EXACT_CODE.test('Women A6')).toBe(false);
  });
  it('the production line is read without the FC- prefix', () => {
    expect(['FC-PAN6-Bundle', 'PAN6BUNDLE', 'fc-br2', 'SH1', 'FC-NEW9'].map((m) => lineBase(m).match(/^(PAN|BR|SH)/)?.[1] ?? 'other')).toEqual(['PAN', 'PAN', 'BR', 'SH', 'other']);
  });
});
