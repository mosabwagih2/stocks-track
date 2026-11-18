import { describe, expect, it } from 'vitest';
import { latinDigits, parseDmy, toDmyText } from './dateInput';

describe('the date box: day-month-year, Latin digits', () => {
  it('reads dd-mm-yyyy with - / or . and one or two digits', () => {
    expect(parseDmy('03-11-2026')).toBe('2026-11-03'); expect(parseDmy('3/11/2026')).toBe('2026-11-03'); expect(parseDmy(' 18.11.2026 ')).toBe('2026-11-18');
  });
  it('reads Arabic-Indic digits too, and shows them as Latin', () => {
    expect(latinDigits('٠٣-١١-٢٠٢٦ ۱۲')).toBe('03-11-2026 12'); expect(parseDmy('٠٣/١١/٢٠٢٦')).toBe('2026-11-03');
  });
  it('refuses a day that does not exist or text that is not a date', () => {
    expect(parseDmy('31-02-2026')).toBeNull(); expect(parseDmy('29-02-2026')).toBeNull(); expect(parseDmy('29-02-2028')).toBe('2028-02-29');
    expect(parseDmy('2026-11-03')).toBeNull(); expect(parseDmy('3-11-26')).toBeNull(); expect(parseDmy('')).toBeNull(); expect(parseDmy('abc')).toBeNull();
  });
  it('shows a stored day as dd-mm-yyyy, and nothing for anything else', () => {
    expect(toDmyText('2026-11-03')).toBe('03-11-2026'); expect(toDmyText('')).toBe(''); expect(toDmyText('03-11-2026')).toBe('');
  });
});
