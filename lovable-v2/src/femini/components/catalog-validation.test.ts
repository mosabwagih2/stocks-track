import { describe, expect, it } from 'vitest';
import { normalizeModelCode, validateNewModel } from './catalog-validation';

const valid = { code: 'PAN6', name: 'بانتي', min: '0', colors: ['اسود'], sizes: ['L'] };
describe('model form validation', () => {
  it('accepts a complete model', () => expect(validateNewModel(valid, false)).toEqual({}));
  it('requires a model name', () => expect(validateNewModel({ ...valid, name: ' ' }, false).name).toBeTruthy());
  it('rejects a duplicate code', () => expect(validateNewModel(valid, true).code).toBeTruthy());
  it('requires a valid model code', () => expect(validateNewModel({ ...valid, code: '123' }, false).code).toBeTruthy());
  it.each(['pa-3', 'pa 3', 'PA3', ' Pa_3 '])('accepts the code %j as PA3', (code) => { expect(normalizeModelCode(code)).toBe('PA3'); expect(validateNewModel({ ...valid, code }, false)).toEqual({}); });
  it('requires colors', () => expect(validateNewModel({ ...valid, colors: [] }, false).colors).toBeTruthy());
  it('requires sizes', () => expect(validateNewModel({ ...valid, sizes: [] }, false).sizes).toBeTruthy());
  it('rejects negative alert thresholds', () => expect(validateNewModel({ ...valid, min: '-1' }, false).min).toBeTruthy());
  it('rejects fractional alert thresholds', () => expect(validateNewModel({ ...valid, min: '1.5' }, false).min).toBeTruthy());
});