export const cn = (...a: (string | false | null | undefined)[]): string => a.filter(Boolean).join(' ');
export const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
export const pct = (a: number, b: number): number => (b ? Math.round((a / b) * 100) : 0);
