/**
 * Does a product label ("BR2 · احمر · XL") match what was typed ("br2 احمر l")? Every typed word must match one word of the
 * label: exactly, or as the start of it when it is two letters or more (so "br" finds BR2 and "احم" finds احمر). A single letter
 * only matches a whole word: "l" finds the size L, never the "L" inside XL or 2XL. Order does not matter, case does not matter. Pure.
 */
export const labelWords = (label: string): string[] => label.toLowerCase().split(/[\s·\-_/]+/).filter(Boolean);
export const queryWords = (q: string): string[] => q.trim().toLowerCase().split(/\s+/).filter(Boolean);
export function labelMatches(label: string, q: string): boolean {
  const t = queryWords(q); if (!t.length) return false;
  const w = labelWords(label);
  return t.every((x) => w.some((y) => y === x || (x.length >= 2 && y.startsWith(x))));
}
