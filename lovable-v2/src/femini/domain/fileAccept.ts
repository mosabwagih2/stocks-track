/**
 * Does a dropped file match what a file input accepts? `accept` is the input's own list: extensions (".xlsx"), a family
 * ("image/*") or an exact type ("application/json"). A file input only filters its picker; a dropped file is not filtered
 * by the browser at all, so the same test has to run here. Pure.
 */
export function acceptsFile(f: { name: string; type?: string }, accept: string): boolean {
  const list = accept.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return true;
  const name = f.name.toLowerCase(); const type = (f.type ?? '').toLowerCase();
  return list.some((a) => (a.startsWith('.') ? name.endsWith(a) : a.endsWith('/*') ? type.startsWith(a.slice(0, -1)) : type === a));
}
