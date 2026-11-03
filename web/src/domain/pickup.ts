import type { Sku } from './types';

export interface ParsedOrder {
  ref: string; waybill: string; type: 'new' | 'exchange'; gov: string; total: number; lines: string[]; unmapped: unknown[];
}
const COLS = { ref: 'كود الاوردر العشوائي', wb: 'بوليصة الشحن', ty: 'حالة الاوردر الجزئية', gov: 'المحافظة', total: 'المبلغ توتال بالشحن للاوردر', items: 'المنتجات المطلوبة في الاوردر' };
const LINE_RE = /^(.*?) \( (.*?) \)-(.*)-(.*)-(\d+)$/;

/** Vendoor pickup sheet -> orders. Item format: "FC-BR2 ( name )-L-احمر-2". Customer data is never read. */
export function parsePickupRows(rows: unknown[][], skus: Sku[], existing: Set<string>, alias: Record<string, string> = {}): { orders: ParsedOrder[]; duplicates: string[]; unknownModels: string[] } {
  const head = (rows[0] ?? []).map((x) => String(x).trim());
  const ix = { ref: head.indexOf(COLS.ref), wb: head.indexOf(COLS.wb), ty: head.indexOf(COLS.ty), gov: head.indexOf(COLS.gov), total: head.indexOf(COLS.total), items: head.indexOf(COLS.items) };
  if (ix.ref < 0 || ix.items < 0) throw new Error('الأعمدة المطلوبة مش موجودة (كود الاوردر / المنتجات). الملف لازم يكون بتنسيق فيندور.');
  const models = new Set(skus.map((s) => s.model));
  const idx = new Map(skus.map((s) => [`${s.model}|${s.color}|${s.size}`, s.id]));
  const toModel = (code: string): string | null => alias[code] ?? (/^FC-/.test(code) && models.has(code.slice(3)) ? code.slice(3) : models.has(code) ? code : code === 'Women A5' ? 'A5' : null);
  const orders: ParsedOrder[] = []; const duplicates: string[] = []; const unknown = new Set<string>(); const seen = new Set(existing);
  for (const r of rows.slice(1)) {
    const ref = String(r[ix.ref] ?? '').trim();
    if (!ref) continue;
    if (seen.has(ref)) { duplicates.push(ref); continue; }
    seen.add(ref);
    const o: ParsedOrder = { ref, waybill: String(r[ix.wb] ?? ''), type: String(r[ix.ty] ?? '').includes('استبدال') ? 'exchange' : 'new', gov: String(r[ix.gov] ?? ''), total: Number(r[ix.total]) || 0, lines: [], unmapped: [] };
    for (const it of String(r[ix.items] ?? '').split(', ')) {
      const m = LINE_RE.exec(it.trim());
      if (!m) { o.unmapped.push([it]); continue; }
      const [, code, , size, color, q] = m;
      const model = toModel(code); const id = model ? idx.get(`${model}|${color.trim()}|${size.trim()}`) : undefined;
      if (id) for (let i = 0; i < +q; i++) o.lines.push(id); else { o.unmapped.push([code, size.trim(), color.trim(), +q]); if (!model) unknown.add(code); }
    }
    orders.push(o);
  }
  return { orders, duplicates, unknownModels: [...unknown] };
}
