import { describe, expect, it } from 'vitest';
import { dmy, dmyText, plainText } from './dates';

const L = '⁦', P = '⁩';   // the left-to-right isolate around a date

describe('dates are shown day-month-year', () => {
  it('turns a yyyy-mm-dd into dd-mm-yyyy, keeps anything else as it was', () => {
    expect(dmy('2026-11-18')).toBe(`${L}18-11-2026${P}`);
    expect(dmy('2026-11-18T10:00:00Z')).toBe(`${L}18-11-2026${P}T10:00:00Z`);
    expect(dmy('')).toBe(''); expect(dmy(undefined)).toBe(''); expect(dmy(null)).toBe(''); expect(dmy('—')).toBe('—'); expect(dmy('18-11-2026')).toBe('18-11-2026');
  });
  it('fixes every date inside a sentence', () => {
    expect(plainText(dmyText('من 2026-10-20 لـ 2026-10-27 (أوردر 23604496)'))).toBe('من 20-10-2026 لـ 27-10-2026 (أوردر 23604496)');
    expect(dmyText('2026-10-20')).toBe(`${L}20-10-2026${P}`);
  });
});
