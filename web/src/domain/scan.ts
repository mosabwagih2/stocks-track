import type { Order } from './types';

export interface ScanRow { code: string; time: string; name: string }

/** Minimal RFC4180 CSV reader (quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = []; let f = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; rows.push(row); row = []; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}

/** Reads a scanner export (QRbot CSV or any sheet with a code column). The QR holds the random order code. */
export function parseScan(rows: string[][]): ScanRow[] {
  const codeRe = /codecontent|^code$|content|الكود|^كود/;
  let hi = -1; let head: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    head = rows[i].map((x) => String(x).trim().toLowerCase());
    if (head.some((h) => codeRe.test(h))) { hi = i; break; }
  }
  if (hi < 0) throw new Error('مش لاقي عمود الكود (CODECONTENT). الملف لازم يكون تصدير QRbot أو فيه عمود بكود الأوردر.');
  const ic = head.findIndex((h) => codeRe.test(h));
  const it = head.findIndex((h) => /^date|time|وقت|تاريخ/.test(h));
  const inm = head.findIndex((h) => /^name$|employee|موظف|^الاسم/.test(h));
  const out: ScanRow[] = [];
  for (const r of rows.slice(hi + 1)) {
    const code = String(r[ic] ?? '').trim();
    if (code) out.push({ code, time: it >= 0 ? String(r[it] ?? '').slice(0, 19) : '', name: inm >= 0 ? String(r[inm] ?? '').trim() : '' });
  }
  return out;
}

export interface ScanMatch {
  scans: number; matched: string[]; duplicates: string[]; already: { ref: string; by?: string | null }[]; unknown: string[]; unmapped: string[];
}
export function matchScans(scans: ScanRow[], orders: Order[]): ScanMatch {
  const idx = new Map<string, Order>();
  for (const o of orders) { if (o.status === 'cancelled') continue; idx.set(o.ref.toLowerCase(), o); if (o.waybill) idx.set(o.waybill, o); }
  const seen = new Set<string>(); const res: ScanMatch = { scans: scans.length, matched: [], duplicates: [], already: [], unknown: [], unmapped: [] };
  for (const s of scans) {
    const k = s.code.toLowerCase();
    if (seen.has(k)) { res.duplicates.push(s.code); continue; }
    seen.add(k);
    const o = idx.get(k);
    if (!o) { res.unknown.push(s.code); continue; }
    if (o.status === 'shipped') { res.already.push({ ref: o.ref, by: o.shippedBy }); continue; }
    if (o.unmapped.length) { res.unmapped.push(o.ref); continue; }
    if (!res.matched.includes(o.ref)) res.matched.push(o.ref);
  }
  return res;
}
