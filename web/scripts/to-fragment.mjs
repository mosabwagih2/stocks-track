// Turns dist-single/index.html into a page fragment (no doctype/html/head/body) with a given title.
// Usage: node scripts/to-fragment.mjs "Fémini Stock App" > out.html
import { readFileSync } from 'node:fs';
const title = process.argv[2] ?? 'Fémini Stock';
let h = readFileSync(new URL('../dist-single/index.html', import.meta.url), 'utf8');
h = h.replace(/<!doctype html>/i, '').replace(/<html[^>]*>/i, '').replace(/<\/html>/i, '').replace(/<\/?head>/gi, '').replace(/<body[^>]*>/i, '').replace(/<\/body>/i, '');
h = h.replace(/<title>.*?<\/title>/s, '').replace(/<meta charset[^>]*>/i, '').replace(/<meta name="viewport"[^>]*>/i, '').replace(/<meta name="theme-color"[^>]*>/i, '').replace(/<link rel="icon"[^>]*>/i, '');
process.stdout.write(`<title>${title}</title>\n` + h.trim() + '\n');
