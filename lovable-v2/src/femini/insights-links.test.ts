import { describe, expect, it } from 'vitest';
import { OP_PREFILL_MAX, opLink } from './insights-tools';

describe('alert links', () => {
  it('open the operation with the items, in a form the operations page reads back exactly', () => {
    const ids = ['SH2|اسود|2XL', 'BR2|ابيض|M'];
    const u = new URL(opLink('CNT', ids), 'https://x');
    expect(u.pathname).toBe('/operations');
    expect(u.searchParams.get('op')).toBe('CNT');
    expect(u.searchParams.get('skus')!.split(',')).toEqual(ids);
  });
  it('keep the address short when an alert is about very many items', () => {
    const ids = Array.from({ length: 300 }, (_, i) => `M${i}`);
    expect(new URL(opLink('LOS', ids), 'https://x').searchParams.get('skus')!.split(',')).toHaveLength(OP_PREFILL_MAX);
  });
});
