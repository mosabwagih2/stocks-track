import type { Sku } from './types';

export interface ParsedOrder {
  ref: string; waybill: string; type: 'new' | 'exchange'; gov: string; total: number; lines: string[]; unmapped: unknown[];
}
const COLS = { ref: 'كود الاوردر العشوائي', wb: 'بوليصة الشحن', ty: 'حالة الاوردر الجزئية', gov: 'المحافظة', total: 'المبلغ توتال بالشحن للاوردر', items: 'المنتجات المطلوبة في الاوردر' };
// code ( name )-size-colour-qty. The size never has a hyphen, the colour may ("اوف-وايت"), so the size is the first part only.
const LINE_RE = /^(.*?) \( (.*?) \)-([^-]*)-(.*)-(\d+)$/;

/** Vendoor product code -> catalog variant. Vendoor writes the model as "BR2", "FC-BR2" or "Women A6"; the prefix is dropped
 * only when what is left is a model of the catalog, so nothing is ever guessed. */
export function itemMapper(skus: Sku[], alias: Record<string, string> = {}) {
  const models = new Set(skus.map((s) => s.model));
  const idx = new Map(skus.map((s) => [`${s.model}|${s.color}|${s.size}`, s.id]));
  const toModel = (code: string): string | null => {
    const c = String(code).trim(); if (alias[c]) return alias[c];
    const bare = c.replace(/^(FC-|Women\s+)/i, '');
    return [c, bare, bare.toUpperCase()].find((m) => models.has(m)) ?? null;
  };
  return (code: string, size: string, color: string) => { const model = toModel(code); return { model, id: model ? idx.get(`${model}|${String(color).trim()}|${String(size).trim()}`) : undefined }; };
}

/** Vendoor pickup sheet -> orders. Item format: "FC-BR2 ( name )-L-احمر-2". Customer data is never read. */
export function parsePickupRows(rows: unknown[][], skus: Sku[], existing: Set<string>, alias: Record<string, string> = {}): { orders: ParsedOrder[]; duplicates: string[]; unknownModels: string[] } {
  const head = (rows[0] ?? []).map((x) => String(x).trim());
  const ix = { ref: head.indexOf(COLS.ref), wb: head.indexOf(COLS.wb), ty: head.indexOf(COLS.ty), gov: head.indexOf(COLS.gov), total: head.indexOf(COLS.total), items: head.indexOf(COLS.items) };
  if (ix.ref < 0 || ix.items < 0) throw new Error('الأعمدة المطلوبة غير موجودة (كود الاوردر / المنتجات). يجب أن يكون الملف بتنسيق فيندور.');
  const map = itemMapper(skus, alias);
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
      const { model, id } = map(code, size, color);
      if (id) for (let i = 0; i < +q; i++) o.lines.push(id); else { o.unmapped.push([code, size.trim(), color.trim(), +q]); if (!model) unknown.add(code); }
    }
    orders.push(o);
  }
  return { orders, duplicates, unknownModels: [...unknown] };
}
