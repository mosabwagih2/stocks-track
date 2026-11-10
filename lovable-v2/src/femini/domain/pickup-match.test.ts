import { describe, expect, it } from 'vitest';
import { itemMapper, resolveModel } from './pickup';
import { skuPrefix } from './constants';
import type { Sku } from './types';

describe('which catalog model a pickup code stands for', () => {
  it('keeps the old rules: the code, without FC- / Women, upper-cased, or letters and digits only', () => {
    expect(resolveModel(['BR2', 'PAN5'], 'FC-BR2')).toBe('BR2');
    expect(resolveModel(['A6'], 'Women A6')).toBe('A6');
    expect(resolveModel(['PAN6BUNDLE'], 'FC-PAN6-Bundle')).toBe('PAN6BUNDLE');
    expect(resolveModel(['BR2'], 'FC-ZZZ')).toBeNull();
    expect(resolveModel(['BR2'], 'FC-X', { 'FC-X': 'BR2' })).toBe('BR2');
  });
  it('finds a model that differs only by dashes, spaces or case: FC-PAN6-Bundle is «PAN6 Bundle»', () => {
    expect(resolveModel(['BR2', 'PAN6 Bundle'], 'FC-PAN6-Bundle')).toBe('PAN6 Bundle');
    expect(resolveModel(['pan6_bundle'], 'FC-PAN6-Bundle')).toBe('pan6_bundle');
  });
  it('never guesses between two models that both fit, and ignores a code with no letters or digits', () => {
    expect(resolveModel(['PAN 6 Bundle', 'PAN6 Bundle'], 'FC-PAN6-Bundle')).toBeNull();
    expect(resolveModel(['PAN6 Bundle'], 'FC-')).toBeNull();
    expect(resolveModel(['موديل'], 'FC-غيره')).toBeNull();   // two codes with no Latin letters or digits are never "the same"
    expect(resolveModel(['PAN6 Bundle', 'PAN6BUNDLE'], 'FC-PAN6-Bundle')).toBe('PAN6BUNDLE');   // an exact fit wins
  });
  it('a pickup line of the legacy model: its own size links, a size it lacks is known to be missing', () => {
    const skus = [{ id: 'PAN6_Bundle-X1-FREE', model: 'PAN6 Bundle', color: 'باندل خمس قطع', size: 'FREE', minAlert: 0 }] as unknown as Sku[];
    const map = itemMapper(skus);
    expect(map('FC-PAN6-Bundle', 'FREE', 'باندل خمس قطع')).toEqual({ model: 'PAN6 Bundle', id: 'PAN6_Bundle-X1-FREE' });
    expect(map('FC-PAN6-Bundle', 'L', 'باندل خمس قطع')).toEqual({ model: 'PAN6 Bundle', id: undefined });
  });
  it('an item code the server accepts: a space becomes an underscore', () => {
    expect(skuPrefix('PAN6 Bundle')).toBe('PAN6_Bundle');
    expect(skuPrefix('FC-PAN6-Bundle')).toBe('FC-PAN6-Bundle');
    expect(/^[A-Za-z0-9_.-]{1,40}$/.test(`${skuPrefix('PAN6 Bundle')}-X1-L`)).toBe(true);
  });
});
